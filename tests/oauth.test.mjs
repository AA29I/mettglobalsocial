import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { database } from "../server/db.mjs";
import { connections, decrypt } from "../server/connections.mjs";

test("OAuth uses expiring one-time state and encrypts credentials without exposing them", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mett-oauth-"));
  process.env.DATA_DIR = dir;
  process.env.GOOGLE_CLIENT_ID = "test-only-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-only-client-secret";
  const db = await database(),
    q = db.query,
    previousFetch = globalThis.fetch;
  try {
    await q(
      "INSERT INTO companies (id,name,initials,accent,timezone,created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [
        "company",
        "Mett Global",
        "MG",
        "#abcdef",
        "UTC",
        new Date().toISOString(),
      ],
    );
    const service = await connections(q);
    const u = new URL(await service.authorize("google", "company"));
    assert.equal(u.hostname, "accounts.google.com");
    assert.equal(u.searchParams.get("code_challenge_method"), "S256");
    assert.equal(u.searchParams.get("access_type"), "offline");
    assert.ok(u.searchParams.get("scope").split(" ").includes(
      "https://www.googleapis.com/auth/youtube.force-ssl",
    ), "native scheduling needs a videos.update-compatible scope");
    const state = u.searchParams.get("state");
    const grantedScope = u.searchParams.get("scope");
    assert.equal(
      (await q("SELECT id FROM oauth_states"))[0].id.includes(state),
      false,
    );
    const json = (data) =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    globalThis.fetch = async (input) => {
      const u = new URL(input);
      if (u.hostname === "oauth2.googleapis.com")
        return json({
          access_token: "test-only-access-token",
          refresh_token: "test-only-refresh-token",
          expires_in: 3600,
          scope: grantedScope,
        });
      if (u.pathname === "/drive/v3/about")
        return json({
          user: { displayName: "Owner", permissionId: "drive-user" },
        });
      if (u.pathname === "/youtube/v3/channels")
        return json({
          items: [
            {
              id: "channel",
              snippet: { title: "Mett channel", customUrl: "@mett" },
            },
          ],
        });
      if (u.pathname === "/drive/v3/files")
        return json({
          files: [
            { id: "source", name: "Source video", mimeType: "video/mp4" },
          ],
        });
      throw new Error("Unexpected test request");
    };
    assert.equal(
      await service.callback("google", "test-only-code", state),
      "company",
    );
    await assert.rejects(
      () => service.callback("google", "test-only-code", state),
      /expired|already/,
    );
    const rows = await q("SELECT * FROM connections");
    assert.equal(rows.length, 2);
    await service.googleAccess("company", rows[0].account_id, true);
    const { encrypt } = await import("../server/connections.mjs");
    const originalCredentials = rows[0].credentials;
    await q("UPDATE connections SET credentials=$1 WHERE id=$2", [
      encrypt({ ...decrypt(originalCredentials), scope: "https://www.googleapis.com/auth/youtube.upload" }), rows[0].id,
    ]);
    await assert.rejects(
      () => service.googleAccess("company", rows[0].account_id, true), /Reconnect.*management/,
    );
    await q("UPDATE connections SET credentials=$1 WHERE id=$2", [originalCredentials, rows[0].id]);
    assert.ok(!JSON.stringify(rows).includes("test-only-access-token"));
    assert.equal(
      decrypt(rows[0].credentials).refresh_token,
      "test-only-refresh-token",
    );
    const readiness = service.readiness();
    assert.equal(readiness.google.configured, true);
    assert.ok(!JSON.stringify(readiness).includes("test-only-client-secret"));
    assert.equal(
      (await service.driveFiles("company", rows[0].account_id)).files.length,
      1,
    );
    await assert.rejects(
      () => service.driveFiles("another-company", rows[0].account_id),
      /Authorize/,
    );
    const expired = new URL(
      await service.authorize("google", "company"),
    ).searchParams.get("state");
    await q("UPDATE oauth_states SET expires_at=$1", [
      "2000-01-01T00:00:00.000Z",
    ]);
    await assert.rejects(
      () => service.callback("google", "test-only-code", expired),
      /expired/,
    );
  } finally {
    globalThis.fetch = previousFetch;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
