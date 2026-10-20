import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { database } from "../server/db.mjs";
import { youtube, metadata, driveFileId } from "../server/youtube.mjs";
import { encrypt, decrypt } from "../server/connections.mjs";

test("YouTube validates account-specific metadata and Drive sources", () => {
  const payload = {
    scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    overrides: {
      account: {
        title: "A real title",
        text: "Specific description",
        tags: "one, two",
        audience: "general",
        privacy: "public",
        coverMode: "default",
        aiDisclosure: false,
      },
    },
  };
  assert.deepEqual(metadata(payload, "account").snippet.tags, ["one", "two"]);
  assert.equal(
    metadata(payload, "account").snippet.description,
    "Specific description",
  );
  assert.throws(
    () => metadata({ ...payload, overrides: {} }, "account"),
    /title/,
  );
  assert.throws(
    () =>
      metadata(
        {
          ...payload,
          overrides: {
            account: { ...payload.overrides.account, coverMode: "frame" },
          },
        },
        "account",
      ),
    /Frame extraction/,
  );
  assert.equal(
    driveFileId("https://drive.google.com/file/d/abc12345/view"),
    "abc12345",
  );
  assert.throws(
    () => driveFileId("https://attacker.invalid/file/d/abc12345"),
    /Drive/,
  );
  assert.throws(
    () => driveFileId("https://drive.google.com/drive/folders/abc12345"),
    /specific Drive file/,
  );
});
test("durable YouTube preparation recovers a lost final response without duplicate uploads", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mett-youtube-"));
  process.env.DATA_DIR = dir;
  const db = await database();
  let originalFetch = globalThis.fetch;
  try {
    const ciphertext = encrypt({ refresh_token: "test-only-refresh-token" });
    assert.equal(decrypt(ciphertext).refresh_token, "test-only-refresh-token");
    assert.ok(!ciphertext.includes("test-only"));
    const corrupted = ciphertext.split(".");
    corrupted[2] = Buffer.from("corrupted").toString("base64");
    assert.throws(() => decrypt(corrupted.join(".")));
    const q = db.query,
      company = "company-a",
      account = "account-a",
      post = "post-a";
    await q(
      "INSERT INTO companies (id,name,initials,accent,timezone,created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [
        company,
        "Mett Global",
        "MG",
        "#abcdef",
        "UTC",
        new Date().toISOString(),
      ],
    );
    await q(
      "INSERT INTO accounts (id,company_id,platform,name,handle,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [
        account,
        company,
        "youtube",
        "Test channel",
        "",
        "authorized",
        new Date().toISOString(),
      ],
    );
    const payload = {
      title: "Test",
      accountIds: [account],
      mediaUrl: "https://drive.google.com/file/d/abc12345/view",
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      overrides: {
        [account]: {
          title: "Channel title",
          text: "Channel caption",
          tags: "",
          audience: "general",
          privacy: "public",
          coverMode: "default",
          notifySubscribers: true,
        },
      },
    };
    await q(
      "INSERT INTO posts (id,company_id,title,status,payload,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [
        post,
        company,
        "Test",
        "blocked",
        JSON.stringify(payload),
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
    let uploads = 0,
      scheduled = false,
      videoCreated = false;
    const ok = (data) =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    globalThis.fetch = async (input, options = {}) => {
      const u = new URL(input);
      if (u.pathname.startsWith("/drive/v3/files/")) {
        if (u.searchParams.get("alt") === "media")
          return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
        return ok({
          id: "abc12345",
          name: "Video",
          mimeType: "video/mp4",
          size: "4",
          version: "1",
          capabilities: { canDownload: true },
        });
      }
      if (
        u.pathname === "/upload/youtube/v3/videos" &&
        options.method === "POST"
      ) {
        const data = JSON.parse(options.body);
        assert.equal(data.status.privacyStatus, "private");
        assert.equal(
          data.status.publishAt,
          undefined,
          "do not schedule before the thumbnail is ready",
        );
        return new Response("", {
          status: 200,
          headers: {
            Location:
              "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test",
          },
        });
      }
      if (
        u.pathname === "/upload/youtube/v3/videos" &&
        options.method === "PUT"
      ) {
        if (options.headers["Content-Range"].startsWith("bytes */"))
          return videoCreated
            ? ok({ id: "video-1" })
            : new Response("", { status: 308 });
        uploads++;
        videoCreated = true;
        throw new Error("Simulated lost final response");
      }
      if (u.pathname === "/youtube/v3/videos" && options.method === "PUT") {
        scheduled = true;
        return ok({ id: "video-1" });
      }
      if (u.pathname === "/youtube/v3/videos")
        return ok({
          items: [
            {
              id: "video-1",
              snippet: { channelId: "channel-1" },
              status: {
                privacyStatus: "private",
                publishAt: payload.scheduledAt,
              },
            },
          ],
        });
      throw new Error("Unexpected test network request: " + u.pathname);
    };
    const integrations = {
      googleAccess: async () => ({
        token: "test-only-access-token",
        externalId: "channel-1",
      }),
    };
    let service = await youtube(q, integrations);
    const job = await service.start(company, post, account);
    assert.equal(job.phase, "ready");
    assert.equal(
      (await service.start(company, post, account)).id,
      job.id,
      "preparation start is idempotent",
    );
    await service.step(company, job.id); // creates upload session, no publication time yet
    await assert.rejects(
      () => service.step(company, job.id),
      /lost final response/,
    );
    service = await youtube(q, integrations); // new service instance recovers durable upload session
    assert.equal((await service.step(company, job.id)).phase, "thumbnail");
    assert.equal((await service.step(company, job.id)).phase, "schedule");
    assert.equal(scheduled, false);
    assert.equal((await service.step(company, job.id)).phase, "verifying");
    assert.equal(scheduled, true);
    assert.equal((await service.step(company, job.id)).phase, "scheduled");
    assert.equal((await service.step(company, job.id)).phase, "scheduled");
    assert.equal(uploads, 1);
    assert.equal(
      (await q("SELECT status FROM posts WHERE id=$1", [post]))[0].status,
      "scheduled",
    );
    await assert.rejects(
      () => service.step("another-company", job.id),
      /not found/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
