import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { database } from "../server/db.mjs";
import { youtube } from "../server/youtube.mjs";

// All provider responses here are simulated. No live accounts or media are used.
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "mett-failures-"));
  const oldDir = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  const db = await database(), q = db.query, originalFetch = globalThis.fetch;
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await db.close();
    if (oldDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = oldDir;
    await rm(dir, { recursive: true, force: true });
  });
  const now = new Date().toISOString();
  await q("INSERT INTO companies VALUES ($1,$2,$3,$4,$5,$6)", ["company", "Test", "T", "#e0bc68", "Asia/Karachi", now]);
  const ids = ["channel-a", "channel-b"];
  for (const id of ids)
    await q("INSERT INTO accounts VALUES ($1,$2,$3,$4,$5,$6,$7)", [id, "company", "youtube", id, "", "authorized", now]);
  const payload = {
    title: "Two destinations", accountIds: ids,
    mediaUrl: "https://drive.google.com/file/d/video123/view",
    scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    overrides: Object.fromEntries(ids.map(id => [id, {
      title: `Title ${id}`, text: `Caption ${id}`, tags: id, audience: "general",
      privacy: "public", coverMode: "image",
      coverUrl: `https://drive.google.com/file/d/cover-${id}/view`,
      notifySubscribers: true,
    }])),
  };
  await q("INSERT INTO posts (id,company_id,title,status,payload,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)", ["post", "company", payload.title, "blocked", JSON.stringify(payload), now, now]);
  const f = {
    q, payload, missing: false, version: "1", revoked: false, expired: false,
    failedCover: "", creates: [], uploads: [], covers: [], schedules: [],
  };
  const ok = data => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
  const integrations = { googleAccess: async (_company, account, publishing) => {
    assert.equal(publishing, true, "check schedule permission before provider mutations");
    if (f.revoked) throw new Error("Google authorization expired. Reconnect this account.");
    return { token: account, externalId: account };
  }};
  globalThis.fetch = async (input, options = {}) => {
    const u = new URL(input), account = options.headers.Authorization.replace("Bearer ", "");
    if (u.pathname.startsWith("/drive/v3/files/")) {
      const id = u.pathname.split("/").at(-1), cover = id.startsWith("cover-");
      if (!cover && f.missing) return new Response("", { status: 404 });
      if (u.searchParams.get("alt") === "media")
        return new Response(new Uint8Array([1, 2, 3, 4]), { headers: { "Content-Type": cover ? "image/png" : "video/mp4" } });
      return ok({ id, size: "4", version: f.version, mimeType: cover ? "image/png" : "video/mp4", capabilities: { canDownload: true } });
    }
    if (u.pathname === "/upload/youtube/v3/videos") {
      if (options.method === "POST") {
        f.creates.push({ account, data: JSON.parse(options.body) });
        return new Response("", { headers: { Location: `https://www.googleapis.com/upload/youtube/v3/videos?upload_id=${account}` } });
      }
      if (options.headers["Content-Range"].startsWith("bytes */"))
        return new Response(null, { status: f.expired ? 410 : 308 });
      f.uploads.push(account);
      return ok({ id: `video-${account}` });
    }
    if (u.pathname === "/upload/youtube/v3/thumbnails/set") {
      if (f.failedCover === account) return new Response("", { status: 403 });
      f.covers.push({ account, video: u.searchParams.get("videoId") });
      return ok({ items: [] });
    }
    if (u.pathname === "/youtube/v3/videos") {
      if (options.method === "PUT") { f.schedules.push(account); return ok({ id: `video-${account}` }); }
      return ok({ items: [{ id: `video-${account}`, snippet: { channelId: account }, status: { privacyStatus: "private", publishAt: payload.scheduledAt } }] });
    }
    throw new Error("Unexpected simulated request: " + u.pathname);
  };
  f.service = await youtube(q, integrations);
  f.restart = async () => { f.service = await youtube(q, integrations); };
  f.start = account => f.service.start("company", "post", account || ids[0]);
  f.step = job => f.service.step("company", job.id);
  return f;
}

test("missing Drive source or revoked authorization cannot start an upload", async t => {
  const f = await fixture(t);
  f.missing = true;
  await assert.rejects(() => f.start(), /404/);
  f.missing = false; f.revoked = true;
  await assert.rejects(() => f.start(), /Reconnect/);
  assert.equal((await f.service.list("company")).length, 0);
  assert.equal(f.creates.length, 0);
});

test("changed Drive source is held for review and never silently reuploaded", async t => {
  const f = await fixture(t), job = await f.start();
  await f.step(job);
  f.version = "2";
  await assert.rejects(() => f.step(job), /source video changed/);
  await f.restart();
  assert.equal((await f.step(job)).phase, "needs_review");
  assert.equal((await f.start()).id, job.id);
  assert.equal(f.creates.length, 1);
  assert.equal(f.uploads.length, 0);
});

test("expired upload session requires review across service restart", async t => {
  const f = await fixture(t), job = await f.start();
  await f.step(job);
  f.expired = true;
  assert.equal((await f.step(job)).phase, "needs_review");
  await f.restart();
  assert.equal((await f.step(job)).phase, "needs_review");
  assert.equal(f.creates.length, 1);
  assert.equal(f.uploads.length, 0);
});

test("revoked authorization pauses an existing job and records the error", async t => {
  const f = await fixture(t), job = await f.start();
  f.revoked = true;
  await assert.rejects(() => f.step(job), /Reconnect/);
  const saved = (await f.service.list("company"))[0];
  assert.equal(saved.phase, "ready");
  assert.match(saved.error, /Reconnect/);
  assert.equal(f.creates.length, 0);
  f.revoked = false;
  assert.equal((await f.step(job)).phase, "uploading");
});

test("a processing lease prevents concurrent upload-session creation", async t => {
  const f = await fixture(t), job = await f.start();
  const results = await Promise.allSettled([f.step(job), f.step(job)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.match(results.find(r => r.status === "rejected").reason.message, /being processed/);
  assert.equal(f.creates.length, 1);
});

test("two channels retain independent copy and covers through a partial failure", async t => {
  const f = await fixture(t), a = await f.start("channel-a"), b = await f.start("channel-b");
  for (let n = 0; n < 5; n++) await f.step(a);
  assert.equal((await f.step(a)).phase, "scheduled");
  await f.step(b); await f.step(b);
  f.failedCover = "channel-b";
  await assert.rejects(() => f.step(b), /403/);
  assert.deepEqual(f.schedules, ["channel-a"]);
  assert.equal((await f.q("SELECT status FROM posts WHERE id=$1", ["post"]))[0].status, "blocked");
  await f.restart();
  f.failedCover = "";
  for (let n = 0; n < 3; n++) await f.step(b);
  assert.equal((await f.step(b)).phase, "scheduled");
  assert.deepEqual(f.creates.map(c => [c.account, c.data.snippet.title, c.data.snippet.description]), [
    ["channel-a", "Title channel-a", "Caption channel-a"],
    ["channel-b", "Title channel-b", "Caption channel-b"],
  ]);
  assert.deepEqual(f.covers, [
    { account: "channel-a", video: "video-channel-a" },
    { account: "channel-b", video: "video-channel-b" },
  ]);
  assert.deepEqual(f.uploads, ["channel-a", "channel-b"]);
  assert.equal((await f.q("SELECT status FROM posts WHERE id=$1", ["post"]))[0].status, "scheduled");
  assert.deepEqual(await f.service.list("other-company"), []);
});
