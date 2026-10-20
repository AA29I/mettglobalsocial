import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.mjs";

let service, server, origin, cookie, dir;
async function request(path, method = "GET", body, authenticated = true) {
  const response = await fetch(origin + "/api" + path, {
    method,
    headers: {
      Origin: "http://127.0.0.1:3001",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(authenticated && cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    body: await response.json(),
    cookie: response.headers.get("set-cookie"),
  };
}
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "mett-api-"));
  process.env.DATA_DIR = dir;
  service = await createApp();
  server = service.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  origin = "http://127.0.0.1:" + server.address().port;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await service.close();
  await rm(dir, { recursive: true, force: true });
});
test("owner authentication, persistent drafts, and company boundaries", async (t) => {
  const credentials = {
    username: "test-owner",
    password: "local-test-password-937",
  };
  await t.test("unauthenticated data is inaccessible", async () => {
    assert.equal(
      (await request("/companies", "GET", undefined, false)).status,
      401,
    );
  });
  await t.test(
    "owner setup uses secure server sessions and cannot repeat",
    async () => {
      const setup = await request("/auth/setup", "POST", credentials);
      assert.equal(setup.status, 201);
      assert.match(setup.cookie, /HttpOnly/);
      assert.match(setup.cookie, /SameSite=Strict/);
      cookie = setup.cookie.split(";")[0];
      assert.equal(
        (await request("/auth/setup", "POST", credentials)).status,
        409,
      );
      assert.equal(
        (await request("/auth")).body.user.username,
        credentials.username,
      );
    },
  );
  let a, b, aa, ba, post;
  await t.test(
    "two companies can own multiple same-network accounts",
    async () => {
      const base = {
        initials: "MG",
        accent: "#c5da83",
        timezone: "Asia/Karachi",
      };
      a = (
        await request("/companies", "POST", { ...base, name: "Mett Global" })
      ).body;
      b = (
        await request("/companies", "POST", { ...base, name: "Other company" })
      ).body;
      aa = (
        await request(`/companies/${a.id}/accounts`, "POST", {
          platform: "youtube",
          name: "Main channel",
        })
      ).body;
      ba = (
        await request(`/companies/${b.id}/accounts`, "POST", {
          platform: "youtube",
          name: "Other channel",
        })
      ).body;
      const aa2 = await request(`/companies/${a.id}/accounts`, "POST", {
        platform: "youtube",
        name: "Second channel",
      });
      assert.equal(aa2.status, 201);
      assert.equal(aa.status, "disconnected");
    },
  );
  const payload = () => ({
    title: "Independent settings",
    text: "Shared caption",
    timezone: "Asia/Karachi",
    accountIds: [aa.id],
    overrides: {
      [aa.id]: {
        text: "Channel-specific caption",
        title: "Custom channel title",
        coverMode: "image",
        coverUrl: "https://drive.google.com/file/d/test-cover/view",
      },
    },
  });
  await t.test(
    "draft retains per-account copy and cover preferences",
    async () => {
      const saved = await request(
        `/companies/${a.id}/posts`,
        "POST",
        payload(),
      );
      assert.equal(saved.status, 201);
      post = saved.body;
      const workspace = (await request(`/companies/${a.id}/workspace`)).body;
      assert.equal(
        workspace.posts[0].payload.overrides[aa.id].text,
        "Channel-specific caption",
      );
      assert.equal(
        workspace.posts[0].payload.overrides[aa.id].coverMode,
        "image",
      );
      assert.equal(workspace.posts[0].status, "draft");
    },
  );
  await t.test(
    "reject foreign accounts, overrides and mutation paths",
    async () => {
      assert.equal(
        (
          await request(`/companies/${a.id}/posts`, "POST", {
            ...payload(),
            accountIds: [ba.id],
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(`/companies/${a.id}/posts`, "POST", {
            ...payload(),
            overrides: { [ba.id]: { text: "foreign" } },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(`/companies/${b.id}/posts/${post.id}`, "PUT", {
            title: "Attack",
            timezone: "UTC",
          })
        ).status,
        404,
      );
      assert.equal(
        (await request(`/companies/${b.id}/posts/${post.id}`, "DELETE")).status,
        404,
      );
      assert.equal(
        (await request(`/companies/${b.id}/accounts/${aa.id}`, "DELETE"))
          .status,
        404,
      );
      const other = (await request(`/companies/${b.id}/workspace`)).body;
      assert.equal(other.posts.length, 0);
      assert.equal(other.accounts.length, 1);
    },
  );
  await t.test(
    "queue without provider access is explicitly blocked, never published",
    async () => {
      const queued = await request(
        `/companies/${a.id}/posts/${post.id}`,
        "PUT",
        {
          ...payload(),
          intent: "queue",
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        },
      );
      assert.equal(queued.status, 200);
      assert.equal(queued.body.status, "blocked");
      assert.match(queued.body.reason, /will not auto-publish/);
      assert.equal(
        (
          await request(`/companies/${a.id}/posts`, "POST", {
            ...payload(),
            intent: "queue",
            scheduledAt: "2020-01-01T00:00:00.000Z",
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "Drive references are scoped and URL schemes validated",
    async () => {
      const media = await request(`/companies/${a.id}/media`, "POST", {
        name: "Source video",
        kind: "video",
        url: "https://drive.google.com/file/d/test-video/view",
      });
      assert.equal(media.status, 201);
      assert.equal(
        (await request(`/companies/${b.id}/media/${media.body.id}`, "DELETE"))
          .status,
        404,
      );
      assert.equal(
        (
          await request(`/companies/${a.id}/media`, "POST", {
            name: "Invalid",
            kind: "video",
            url: "javascript:alert(1)",
          })
        ).status,
        400,
      );
    },
  );
  await t.test("origin protection rejects cross-site changes", async () => {
    const response = await fetch(origin + "/api/companies", {
      method: "POST",
      headers: {
        Origin: "https://attacker.invalid",
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(response.status, 403);
  });
  await t.test("logout invalidates the previous session", async () => {
    assert.equal((await request("/auth/logout", "POST", {})).status, 200);
    assert.equal((await request("/companies")).status, 401);
    const signed = await request("/auth/login", "POST", credentials);
    assert.equal(signed.status, 200);
    cookie = signed.cookie.split(";")[0];
  });
  await t.test("saved data survives database reopen", async () => {
    await new Promise((r) => server.close(r));
    await service.close();
    service = await createApp();
    server = service.app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    origin = "http://127.0.0.1:" + server.address().port;
    const workspace = await request(`/companies/${a.id}/workspace`);
    assert.equal(workspace.status, 200);
    assert.equal(
      workspace.body.posts[0].payload.overrides[aa.id].text,
      "Channel-specific caption",
    );
    assert.equal(workspace.body.media.length, 1);
  });
});
