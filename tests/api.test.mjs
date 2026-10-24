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
  await t.test(
    "unified inbox provides conversations, local replies, and status persistence",
    async () => {
      const workspace = (await request(`/companies/${a.id}/workspace`)).body;
      assert.ok(Array.isArray(workspace.conversations));
      assert.ok(workspace.conversations.length > 0);
      const conv = workspace.conversations[0];
      assert.ok(conv.participant_name);
      assert.ok(conv.messages.length > 0);

      const reply = await request(
        `/companies/${a.id}/inbox/${conv.id}/replies`,
        "POST",
        { body: "Thank you for reaching out! We will review your request." },
      );
      assert.equal(reply.status, 201);
      assert.equal(reply.body.delivery_source, "local");
      assert.equal(reply.body.direction, "outbound");

      const patched = await request(
        `/companies/${a.id}/inbox/${conv.id}`,
        "PATCH",
        { status: "resolved", unread: false },
      );
      assert.equal(patched.status, 200);
      assert.equal(patched.body.status, "resolved");
      assert.equal(patched.body.unread, false);

      const updatedWs = (await request(`/companies/${a.id}/workspace`)).body;
      const reloadedConv = updatedWs.conversations.find((c) => c.id === conv.id);
      assert.equal(reloadedConv.status, "resolved");
      assert.equal(reloadedConv.unread, false);
      assert.ok(
        reloadedConv.messages.some(
          (m) =>
            m.delivery_source === "local" &&
            m.body.includes("Thank you for reaching out"),
        ),
      );
    },
  );
  await t.test(
    "reporting templates and hashtag tracker support persistent CRUD and snapshot refresh",
    async () => {
      const initialWs = (await request(`/companies/${a.id}/workspace`)).body;
      assert.ok(Array.isArray(initialWs.reportTemplates));
      assert.ok(Array.isArray(initialWs.trackedHashtags));
      assert.ok(initialWs.reportTemplates.length > 0);
      assert.ok(initialWs.trackedHashtags.length > 0);

      // Create new template
      const newTpl = await request(
        `/companies/${a.id}/reports/templates`,
        "POST",
        {
          name: "Quarterly Board Presentation",
          period_days: 90,
          platforms: ["instagram", "youtube"],
          include_summary: true,
          include_network_overview: true,
          include_top_posts: false,
        },
      );
      assert.equal(newTpl.status, 201);
      assert.equal(newTpl.body.name, "Quarterly Board Presentation");
      assert.equal(newTpl.body.period_days, 90);

      // Verify in workspace
      let ws = (await request(`/companies/${a.id}/workspace`)).body;
      assert.ok(ws.reportTemplates.some((t) => t.id === newTpl.body.id));

      // Delete template
      const delTpl = await request(
        `/companies/${a.id}/reports/templates/${newTpl.body.id}`,
        "DELETE",
      );
      assert.equal(delTpl.status, 200);

      ws = (await request(`/companies/${a.id}/workspace`)).body;
      assert.ok(!ws.reportTemplates.some((t) => t.id === newTpl.body.id));

      // Track a new hashtag
      const newTag = await request(`/companies/${a.id}/hashtags`, "POST", {
        platform: "instagram",
        tag: "#viralgrowth",
        posts_count: 50,
        reach: 12000,
        interactions: 850,
      });
      assert.equal(newTag.status, 201);
      assert.equal(newTag.body.tag, "#viralgrowth");
      assert.equal(newTag.body.posts_count, 50);

      // Refresh snapshot for hashtag
      const refreshed = await request(
        `/companies/${a.id}/hashtags/${newTag.body.id}/snapshot`,
        "POST",
        {},
      );
      assert.equal(refreshed.status, 200);
      assert.ok(refreshed.body.posts_count >= 50);
      assert.ok(refreshed.body.reach >= 12000);

      // Delete hashtag
      const delTag = await request(
        `/companies/${a.id}/hashtags/${newTag.body.id}`,
        "DELETE",
      );
      assert.equal(delTag.status, 200);

      ws = (await request(`/companies/${a.id}/workspace`)).body;
      assert.ok(!ws.trackedHashtags.some((h) => h.id === newTag.body.id));
    },
  );
  await t.test(
    "SmartLinks link-in-bio microsite provides public route /s/:slug, visit & click tracking, and management CRUD",
    async () => {
      const ws = (await request(`/companies/${a.id}/workspace`)).body;
      assert.ok(ws.smartlink, "workspace includes smartlink");
      assert.ok(ws.smartlink.slug, "smartlink has slug");
      assert.ok(ws.smartlink.items.length > 0, "smartlink has seeded items");

      const slug = ws.smartlink.slug;
      const initialVisits = ws.smartlink.visits;

      // Public HTML route /s/:slug
      const publicPage = await fetch(`${origin}/s/${slug}`);
      assert.equal(publicPage.status, 200);
      const html = await publicPage.text();
      assert.ok(html.includes("Link in Bio") || html.includes("smartlink-btn"));
      assert.ok(html.includes(ws.smartlink.title));

      // Public API route GET /api/public/smartlinks/:slug
      const publicJson = await request(`/public/smartlinks/${slug}`);
      assert.equal(publicJson.status, 200);
      assert.equal(publicJson.body.smartlink.slug, slug);
      assert.ok(publicJson.body.smartlink.visits >= initialVisits + 1);

      // Public visit counter POST /api/public/smartlinks/:slug/visit
      const visitRes = await request(`/public/smartlinks/${slug}/visit`, "POST", {});
      assert.equal(visitRes.status, 200);
      assert.ok(visitRes.body.visits > initialVisits);

      // Click counter POST /api/public/smartlinks/:slug/clicks/:itemId
      const testItem = ws.smartlink.items[0];
      const initialClicks = testItem.clicks;
      const clickRes = await request(
        `/public/smartlinks/${slug}/clicks/${testItem.id}`,
        "POST",
        {},
      );
      assert.equal(clickRes.status, 200);
      assert.equal(clickRes.body.clicks, initialClicks + 1);

      // Public redirect GET /s/:slug/c/:itemId
      const redirectRes = await fetch(`${origin}/s/${slug}/c/${testItem.id}`, {
        redirect: "manual",
      });
      assert.equal(redirectRes.status, 302);
      assert.equal(redirectRes.headers.get("location"), testItem.url);

      // Authenticated update of smartlink settings
      const updatedSlug = `brand-link-${Date.now()}`;
      const patchRes = await request(`/companies/${a.id}/smartlink`, "PUT", {
        title: "Mett Global Official",
        slug: updatedSlug,
        description: "Curated links and official destinations.",
        theme: "midnight",
      });
      assert.equal(patchRes.status, 200);
      assert.equal(patchRes.body.slug, updatedSlug);
      assert.equal(patchRes.body.title, "Mett Global Official");
      assert.equal(patchRes.body.theme, "midnight");

      // Add a new link button
      const newItem = await request(`/companies/${a.id}/smartlink/items`, "POST", {
        label: "Podcast Series",
        url: "https://spotify.com/mettglobal",
        color: "#059669",
      });
      assert.equal(newItem.status, 201);
      assert.equal(newItem.body.label, "Podcast Series");
      assert.equal(newItem.body.color, "#059669");

      // Update link button
      const editItem = await request(
        `/companies/${a.id}/smartlink/items/${newItem.body.id}`,
        "PUT",
        {
          label: "Executive Podcast Series",
          color: "#4f46e5",
        },
      );
      assert.equal(editItem.status, 200);
      assert.equal(editItem.body.label, "Executive Podcast Series");
      assert.equal(editItem.body.color, "#4f46e5");

      // Delete link button
      const delItem = await request(
        `/companies/${a.id}/smartlink/items/${newItem.body.id}`,
        "DELETE",
      );
      assert.equal(delItem.status, 200);

      // Verify workspace has updated smartlink and deleted item is gone
      const finalWs = (await request(`/companies/${a.id}/workspace`)).body;
      assert.equal(finalWs.smartlink.slug, updatedSlug);
      assert.ok(!finalWs.smartlink.items.some((it) => it.id === newItem.body.id));
    },
  );
  await t.test(
    "Ads overview provides seeded campaigns, connections toggle, and CRUD management",
    async () => {
      // Verify workspace returns seeded campaigns and connections
      const ws = (await request(`/companies/${a.id}/workspace`)).body;
      assert.ok(Array.isArray(ws.adCampaigns));
      assert.ok(ws.adCampaigns.length >= 4);
      assert.ok(ws.adConnections);
      assert.equal(ws.adConnections.meta.connected, true);
      assert.equal(ws.adConnections.google.connected, true);
      assert.equal(ws.adConnections.tiktok.connected, false);

      // Toggle TikTok connection to connected
      const toggleRes = await request(
        `/companies/${a.id}/ads/connections/tiktok/toggle`,
        "POST",
        {},
      );
      assert.equal(toggleRes.status, 200);
      assert.equal(toggleRes.body.connected, true);
      assert.equal(toggleRes.body.platform, "tiktok");

      // Create a new ad campaign
      const newCamp = await request(`/companies/${a.id}/ads/campaigns`, "POST", {
        name: "Meta — Winter Clearance Sale",
        platform: "meta",
        status: "active",
        spend: 350.5,
        impressions: 50000,
        clicks: 1500,
        results: 120,
        objective: "Conversions",
      });
      assert.equal(newCamp.status, 201);
      assert.equal(newCamp.body.name, "Meta — Winter Clearance Sale");
      assert.equal(newCamp.body.platform, "meta");
      assert.equal(newCamp.body.spend, 350.5);
      assert.equal(newCamp.body.ctr, 3.0); // (1500 / 50000) * 100 = 3.00%
      assert.equal(newCamp.body.results, 120);

      // Update campaign
      const editCamp = await request(
        `/companies/${a.id}/ads/campaigns/${newCamp.body.id}`,
        "PUT",
        {
          name: "Meta — Winter Clearance Sale (Scaled)",
          spend: 500,
          impressions: 70000,
          clicks: 2800,
          results: 240,
          status: "active",
        },
      );
      assert.equal(editCamp.status, 200);
      assert.equal(editCamp.body.name, "Meta — Winter Clearance Sale (Scaled)");
      assert.equal(editCamp.body.spend, 500);
      assert.equal(editCamp.body.ctr, 4.0); // (2800 / 70000) * 100 = 4.00%
      assert.equal(editCamp.body.results, 240);

      // Delete campaign
      const delRes = await request(
        `/companies/${a.id}/ads/campaigns/${newCamp.body.id}`,
        "DELETE",
      );
      assert.equal(delRes.status, 200);

      // Verify deleted from workspace
      const finalWs = (await request(`/companies/${a.id}/workspace`)).body;
      assert.ok(!finalWs.adCampaigns.some((c) => c.id === newCamp.body.id));
    },
  );
  await t.test(
    "Autolists refinement supports RSS feed import and circular recycling mode",
    async () => {
      // 1. Create an autolist with circular mode and an RSS feed URL
      const createRes = await request(`/companies/${a.id}/autolists`, "POST", {
        name: "Industry News & Insights",
        platform: "linkedin",
        items: ["Manual post 1: Welcome to Mett Global"],
        slots: [
          { day: 1, time: "10:00" },
          { day: 3, time: "15:00" },
        ],
        is_circular: true,
        feed_url: "https://blog.mettglobal.com/rss",
        feed_prefix: "Fresh Insight: ",
        feed_include_link: true,
        feed_auto_queue: true,
      });
      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.name, "Industry News & Insights");
      assert.equal(createRes.body.is_circular, true);
      assert.equal(createRes.body.feed_url, "https://blog.mettglobal.com/rss");
      // Verify auto-queued feed items were added
      assert.ok(createRes.body.items.length > 1);
      assert.ok(createRes.body.feed_synced_at);

      const autolistId = createRes.body.id;
      const initialItemCount = createRes.body.items.length;
      const firstItem = createRes.body.items[0];
      const secondItem = createRes.body.items[1];

      // 2. Trigger explicit feed sync via POST /companies/:id/autolists/:id/feed/sync
      const syncRes = await request(
        `/companies/${a.id}/autolists/${autolistId}/feed/sync`,
        "POST",
        {},
      );
      assert.equal(syncRes.status, 200);
      assert.equal(syncRes.body.ok, true);
      assert.ok(syncRes.body.feed_synced_at);

      // 3. Cycle queue in circular mode via POST /companies/:id/autolists/:id/cycle
      // The first item should be returned to the end of the queue
      const cycleRes1 = await request(
        `/companies/${a.id}/autolists/${autolistId}/cycle`,
        "POST",
        {},
      );
      assert.equal(cycleRes1.status, 200);
      assert.equal(cycleRes1.body.published, firstItem);
      assert.equal(cycleRes1.body.items[0], secondItem);
      assert.equal(
        cycleRes1.body.items[cycleRes1.body.items.length - 1],
        firstItem,
      );
      assert.equal(cycleRes1.body.items.length, initialItemCount);

      // 4. Update autolist to non-circular mode (is_circular: false)
      const updateRes = await request(
        `/companies/${a.id}/autolists/${autolistId}`,
        "PUT",
        {
          name: "Industry News & Insights (One-Off)",
          platform: "linkedin",
          items: cycleRes1.body.items,
          slots: [{ day: 1, time: "10:00" }],
          is_circular: false,
        },
      );
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.is_circular, false);

      // 5. Cycle queue in non-circular mode
      // The top item should be consumed and removed from the queue
      const cycleRes2 = await request(
        `/companies/${a.id}/autolists/${autolistId}/cycle`,
        "POST",
        {},
      );
      assert.equal(cycleRes2.status, 200);
      assert.equal(cycleRes2.body.published, secondItem);
      assert.equal(cycleRes2.body.items.length, initialItemCount - 1);
      assert.ok(!cycleRes2.body.items.includes(secondItem));

      // Clean up
      const delRes = await request(
        `/companies/${a.id}/autolists/${autolistId}`,
        "DELETE",
      );
      assert.equal(delRes.status, 200);
    },
  );
});
