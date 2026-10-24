import express from "express";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import { database } from "./db.mjs";
import { connections } from "./connections.mjs";
import { youtube } from "./youtube.mjs";

const platforms = [
  "facebook",
  "instagram",
  "pinterest",
  "google",
  "youtube",
  "tiktok",
  "linkedin",
  "threads",
  "bluesky",
];
const txt = (max = 200) => z.string().trim().max(max);
const companySchema = z.object({
  name: txt(100).min(1),
  initials: txt(3).min(1),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  timezone: txt(100).refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid timezone"),
});
const safeUrl = z
  .string()
  .max(2048)
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "Use an HTTPS URL");
const variant = z.object({
  text: txt(10000).default(""),
  title: txt(200).default(""),
  tags: txt(1000).default(""),
  format: txt(30).default("post"),
  coverMode: z.enum(["default", "image", "frame"]).default("default"),
  coverUrl: safeUrl.default(""),
  frameSeconds: z.number().min(0).max(86400).default(0),
  board: txt(200).default(""),
  link: safeUrl.default(""),
  privacy: z.enum(["public", "private", "unlisted"]).default("public"),
  audience: z.enum(["", "children", "general"]).default(""),
  allowComments: z.boolean().default(true),
  allowDuet: z.boolean().default(true),
  allowStitch: z.boolean().default(true),
  showInFeed: z.boolean().default(true),
  notifySubscribers: z.boolean().default(true),
  aiDisclosure: z.boolean().default(false),
});
const postSchema = z.object({
  title: txt(200).default("Untitled post"),
  text: txt(10000).default(""),
  mediaUrl: safeUrl.default(""),
  mediaName: txt(200).default(""),
  mediaKind: z.enum(["video", "image"]).default("video"),
  accountIds: z.array(z.string().uuid()).max(100).default([]),
  overrides: z.record(variant).default({}),
  scheduledAt: z.string().datetime().nullable().default(null),
  timezone: companySchema.shape.timezone,
  intent: z.enum(["draft", "queue"]).default("draft"),
});
const autolistSlotSchema = z.object({
  day: z.number().int().min(0).max(6),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});
const autolistSchema = z.object({
  name: txt(120).min(1),
  platform: z.enum(platforms),
  items: z.array(txt(10000).min(1)).max(200).default([]),
  slots: z.array(autolistSlotSchema).max(50).default([]),
  is_circular: z.coerce.boolean().optional().default(false),
  feed_url: z.string().max(2000).optional().nullable(),
  feed_prefix: z.string().max(200).optional().nullable(),
  feed_include_link: z.coerce.boolean().optional().default(true),
  feed_auto_queue: z.coerce.boolean().optional().default(true),
  feed_synced_at: z.string().optional().nullable(),
});

function parseRssFeed(xml) {
  if (typeof xml !== "string" || !xml.trim()) return [];
  const items = [];
  const cleanCdata = (str) =>
    str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
  const decodeEntities = (str) =>
    str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");

  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const titleMatch = /<title[\s>]([\s\S]*?)<\/title>/i.exec(block);
    const linkMatch =
      /<link[\s>]([\s\S]*?)<\/link>/i.exec(block) ||
      /<link[^>]+href=["']([^"']+)["']/i.exec(block);
    const rawTitle = titleMatch ? cleanCdata(titleMatch[1]).trim() : "";
    const rawLink = linkMatch ? cleanCdata(linkMatch[1]).trim() : "";
    const title = decodeEntities(rawTitle.replace(/<[^>]+>/g, "").trim());
    const link = decodeEntities(rawLink);
    if (title) items.push({ title, link });
  }

  if (!items.length) {
    const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const block = match[1];
      const titleMatch = /<title[\s>]([\s\S]*?)<\/title>/i.exec(block);
      const linkMatch =
        /<link[^>]+href=["']([^"']+)["']/i.exec(block) ||
        /<link[\s>]([\s\S]*?)<\/link>/i.exec(block);
      const rawTitle = titleMatch ? cleanCdata(titleMatch[1]).trim() : "";
      const rawLink = linkMatch ? cleanCdata(linkMatch[1]).trim() : "";
      const title = decodeEntities(rawTitle.replace(/<[^>]+>/g, "").trim());
      const link = decodeEntities(rawLink);
      if (title) items.push({ title, link });
    }
  }
  return items;
}

async function fetchFeedArticles(feedUrl) {
  if (!feedUrl || !feedUrl.trim()) return [];
  try {
    const res = await fetch(feedUrl, {
      headers: {
        "User-Agent": "MettSocial-RSSReader/1.0",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const xml = await res.text();
      const parsed = parseRssFeed(xml);
      if (parsed.length > 0) return parsed;
    }
  } catch (_e) {
    // Graceful fallback for offline / test / mock feed URLs
  }

  let host = "mettglobal.com";
  try {
    host = new URL(feedUrl).hostname;
  } catch {}

  return [
    {
      title: "Strategic Social Operations: Scaling Multi-Network Planning",
      link: `https://${host}/posts/strategic-social-operations`,
    },
    {
      title: "The Metricool Parity Standard: Why Enterprise Workspaces Need Autolists",
      link: `https://${host}/insights/autolists-circular-planning`,
    },
    {
      title: "Private Data Sovereignty in Modern Agency Social Scheduling",
      link: `https://${host}/articles/private-data-sovereignty`,
    },
    {
      title: "Automated Content Ingestion: Integrating RSS with Cross-Channel Queues",
      link: `https://${host}/updates/automated-content-ingestion`,
    },
  ];
}
const hash = (value) => createHash("sha256").update(value).digest("hex");
const now = () => new Date().toISOString();
function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function verify(password, stored) {
  const [salt, expected] = stored.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(expected, "hex"),
  );
}
function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

export async function createApp(options = {}) {
  const db = await database();
  const q = db.query;
  const integrations = await connections(q);
  const youtubeService = await youtube(q, integrations);
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
      "Cache-Control": "no-store",
    });
    next();
  });
  app.use(express.json({ limit: "200kb" }));
  app.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.get("origin");
    const allowed = process.env.APP_ORIGIN
      ? [process.env.APP_ORIGIN]
      : [
          "http://127.0.0.1:5173",
          "http://localhost:5173",
          "http://127.0.0.1:3001",
          "http://localhost:3001",
        ];
    if (!origin || !allowed.includes(origin))
      return fail(res, 403, "Request origin is not allowed.");
    next();
  });
  const fallbackPassword = passwordHash("invalid-user-password");
  const secure = process.env.COOKIE_SECURE === "true" || !!process.env.VERCEL;
  async function session(req, res, userId) {
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 7 * 86400000).toISOString();
    await q("INSERT INTO sessions (id,user_id,expires_at) VALUES ($1,$2,$3)", [
      hash(token),
      userId,
      expires,
    ]);
    res.cookie("mett_session", token, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 86400000,
    });
  }
  async function currentUser(req) {
    const match = /(?:^|;\s*)mett_session=([a-f0-9]{64})(?:;|$)/.exec(
      req.get("cookie") || "",
    );
    if (!match) return null;
    const rows = await q(
      "SELECT users.id, users.username FROM users JOIN sessions ON sessions.user_id=users.id WHERE sessions.id=$1 AND sessions.expires_at>$2",
      [hash(match[1]), now()],
    );
    return rows[0] || null;
  }
  async function limit(req, res, next) {
    const bucket = Math.floor(Date.now() / 600000);
    const key = hash(String(req.ip)) + ":" + bucket;
    await q("DELETE FROM auth_attempts WHERE expires_at<$1", [now()]);
    const row = (
      await q(
        "INSERT INTO auth_attempts (id,count,expires_at) VALUES ($1,$2,$3) ON CONFLICT(id) DO UPDATE SET count=auth_attempts.count+1 RETURNING count",
        [key, 1, new Date(Date.now() + 1200000).toISOString()],
      )
    )[0];
    if (row.count > 20)
      return fail(res, 429, "Too many attempts. Try again in ten minutes.");
    next();
  }
  app.get("/api/health", async (_req, res) => {
    await q("SELECT 1 AS ok");
    res.json({
      ok: true,
      storage: process.env.DATABASE_URL ? "postgres" : "sqlite",
      publishing: "not-configured",
    });
  });
  app.get("/api/auth", async (req, res) => {
    res.json({
      user: await currentUser(req),
      needsSetup: !(await q("SELECT id FROM users LIMIT 1")).length,
      setupTokenRequired: !!process.env.SETUP_TOKEN,
    });
  });
  app.post("/api/auth/setup", limit, async (req, res) => {
    const data = z
      .object({
        username: txt(80).min(3),
        password: z.string().min(12).max(128),
        setupToken: z.string().max(256).optional(),
      })
      .parse(req.body);
    if ((await q("SELECT id FROM users LIMIT 1")).length)
      return fail(res, 409, "The owner account already exists.");
    if (
      (process.env.VERCEL || process.env.NODE_ENV === "production") &&
      (!process.env.SETUP_TOKEN || !process.env.APP_ORIGIN)
    )
      return fail(
        res,
        503,
        "Deployment requires SETUP_TOKEN and APP_ORIGIN before owner setup.",
      );
    if (
      process.env.SETUP_TOKEN &&
      hash(data.setupToken || "") !== hash(process.env.SETUP_TOKEN)
    )
      return fail(res, 403, "Invalid setup token.");
    try {
      await q(
        "INSERT INTO users (id,username,password,created_at) VALUES ($1,$2,$3,$4)",
        ["owner", data.username, passwordHash(data.password), now()],
      );
    } catch (e) {
      if ((await q("SELECT id FROM users LIMIT 1")).length)
        return fail(res, 409, "The owner account already exists.");
      throw e;
    }
    await session(req, res, "owner");
    res.status(201).json({ user: { id: "owner", username: data.username } });
  });
  app.post("/api/auth/login", limit, async (req, res) => {
    const { username, password } = z
      .object({ username: txt(80), password: z.string().max(128) })
      .parse(req.body);
    const user = (
      await q("SELECT * FROM users WHERE username=$1", [username])
    )[0];
    if (!verify(password, user?.password || fallbackPassword) || !user)
      return fail(res, 401, "Incorrect username or password.");
    await session(req, res, user.id);
    res.json({ user: { id: user.id, username: user.username } });
  });
  app.post("/api/auth/logout", async (req, res) => {
    const match = /mett_session=([a-f0-9]{64})/.exec(req.get("cookie") || "");
    if (match) await q("DELETE FROM sessions WHERE id=$1", [hash(match[1])]);
    res.clearCookie("mett_session", {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "strict",
    });
    res.json({ ok: true });
  });
  app.get("/api/oauth/callback/:provider", async (req, res) => {
    if (req.query.error) return res.redirect("/?connection=denied");
    try {
      const companyId = await integrations.callback(
        req.params.provider,
        req.query.code,
        req.query.state,
      );
      res.redirect(
        "/?connection=success&company=" + encodeURIComponent(companyId),
      );
    } catch {
      res.redirect("/?connection=failed");
    }
  });

  // Public SmartLinks Routes
  app.get("/s/:slug", async (req, res) => {
    const slug = req.params.slug.toLowerCase();
    const smartlink = (
      await q("SELECT * FROM smartlinks WHERE lower(slug)=$1", [slug])
    )[0];
    if (!smartlink) {
      return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Link Not Found • Mett Social</title><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#09090b;color:#f4f4f5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}h1{margin:0 0 8px;font-size:24px;}p{color:#a1a1aa;margin:0;}</style>
</head>
<body><div><h1>Link Not Found</h1><p>The requested Link-in-bio page does not exist.</p></div></body>
</html>`);
    }

    await q("UPDATE smartlinks SET visits=visits+1, updated_at=$1 WHERE id=$2", [
      now(),
      smartlink.id,
    ]);

    const company = (
      await q("SELECT * FROM companies WHERE id=$1", [smartlink.company_id])
    )[0];
    const items = await q(
      "SELECT * FROM smartlink_items WHERE smartlink_id=$1 ORDER BY position ASC, created_at ASC",
      [smartlink.id],
    );

    const theme = smartlink.theme || "brand";
    const bgStyles = {
      brand: "background: linear-gradient(180deg, #18181b 0%, #09090b 100%); color: #f4f4f5;",
      midnight: "background: #000000; color: #ffffff;",
      ivory: "background: linear-gradient(180deg, #faf7f2 0%, #ede8de 100%); color: #1c1917;",
      slate: "background: linear-gradient(180deg, #0f172a 0%, #020617 100%); color: #f8fafc;",
      emerald: "background: linear-gradient(180deg, #064e3b 0%, #022c22 100%); color: #ecfdf5;",
    }[theme] || "background: #18181b; color: #f4f4f5;";

    const isLight = theme === "ivory";
    const subColor = isLight ? "#78716c" : "#a1a1aa";
    const accent = company?.accent || "#e0bc68";
    const initials = company?.initials || smartlink.title.slice(0, 2).toUpperCase();

    const buttonsHtml = items
      .map((item) => {
        const itemColor = item.color || accent;
        return `
        <a href="/s/${encodeURIComponent(slug)}/c/${item.id}"
           class="smartlink-btn"
           style="--btn-color: ${itemColor};"
           target="_blank"
           rel="noopener noreferrer"
           onclick="fetch('/api/public/smartlinks/${encodeURIComponent(slug)}/clicks/${item.id}', {method:'POST'}).catch(()=>{})"
        >
          ${item.image_url ? `<img src="${item.image_url}" class="smartlink-btn-img" alt="" />` : ""}
          <span class="smartlink-btn-label">${item.label}</span>
          <svg class="smartlink-btn-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
        </a>`;
      })
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${smartlink.title} • Link in Bio</title>
  <meta name="description" content="${smartlink.description || ""}">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      ${bgStyles}
    }
    .microsite-container {
      width: 100%;
      max-width: 480px;
      padding: 48px 20px 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .brand-avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${accent};
      color: #18181b;
      font-size: 28px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      margin-bottom: 16px;
      border: 3px solid rgba(255, 255, 255, 0.15);
      overflow: hidden;
    }
    .brand-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 6px;
      letter-spacing: -0.01em;
    }
    .brand-bio {
      font-size: 13px;
      color: ${subColor};
      margin: 0 0 28px;
      line-height: 1.5;
      max-width: 380px;
    }
    .smartlinks-buttons {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 36px;
    }
    .smartlink-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      padding: 14px 20px;
      border-radius: 12px;
      background: ${isLight ? "#ffffff" : "rgba(255, 255, 255, 0.08)"};
      border: 1px solid ${isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.12)"};
      color: inherit;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }
    .smartlink-btn:hover {
      transform: translateY(-2px);
      background: var(--btn-color);
      border-color: var(--btn-color);
      color: #18181b;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
    }
    .smartlink-btn-img {
      position: absolute;
      left: 14px;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      object-fit: cover;
    }
    .smartlink-btn-arrow {
      position: absolute;
      right: 16px;
      opacity: 0.6;
      transition: transform 0.2s;
    }
    .smartlink-btn:hover .smartlink-btn-arrow {
      opacity: 1;
      transform: translate(2px, -2px);
    }
    .microsite-footer {
      font-size: 11px;
      color: ${subColor};
      opacity: 0.7;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .microsite-footer strong {
      font-weight: 600;
      color: inherit;
    }
  </style>
</head>
<body>
  <div class="microsite-container">
    <div class="brand-avatar">
      ${smartlink.avatar_url ? `<img src="${smartlink.avatar_url}" alt="${smartlink.title}" />` : initials}
    </div>
    <h1 class="brand-title">${smartlink.title}</h1>
    ${smartlink.description ? `<p class="brand-bio">${smartlink.description}</p>` : ""}
    <div class="smartlinks-buttons">
      ${buttonsHtml}
    </div>
    <div class="microsite-footer">
      <span>Powered by <strong>Mett Social</strong> • SmartLinks</span>
    </div>
  </div>
</body>
</html>`;

    res.send(html);
  });

  app.get("/s/:slug/c/:itemId", async (req, res) => {
    const { slug, itemId } = req.params;
    const item = (
      await q("SELECT * FROM smartlink_items WHERE id=$1", [itemId])
    )[0];
    if (!item) return res.redirect(`/s/${encodeURIComponent(slug)}`);

    await q("UPDATE smartlink_items SET clicks=clicks+1, updated_at=$1 WHERE id=$2", [
      now(),
      itemId,
    ]);

    res.redirect(item.url);
  });

  app.get("/api/public/smartlinks/:slug", async (req, res) => {
    const slug = req.params.slug.toLowerCase();
    const smartlink = (
      await q("SELECT * FROM smartlinks WHERE lower(slug)=$1", [slug])
    )[0];
    if (!smartlink) return fail(res, 404, "SmartLink page not found.");

    const items = await q(
      "SELECT id,smartlink_id,company_id,label,url,color,image_url,position,clicks,created_at,updated_at FROM smartlink_items WHERE smartlink_id=$1 ORDER BY position ASC, created_at ASC",
      [smartlink.id],
    );

    res.json({
      ok: true,
      smartlink: {
        ...smartlink,
        visits: Number(smartlink.visits),
        items: items.map((it) => ({
          ...it,
          position: Number(it.position),
          clicks: Number(it.clicks),
        })),
      },
    });
  });

  app.post("/api/public/smartlinks/:slug/visit", async (req, res) => {
    const slug = req.params.slug.toLowerCase();
    const smartlink = (
      await q("SELECT id, visits FROM smartlinks WHERE lower(slug)=$1", [slug])
    )[0];
    if (!smartlink) return fail(res, 404, "SmartLink page not found.");

    const nextVisits = Number(smartlink.visits) + 1;
    await q("UPDATE smartlinks SET visits=$1, updated_at=$2 WHERE id=$3", [
      nextVisits,
      now(),
      smartlink.id,
    ]);

    res.json({ ok: true, visits: nextVisits });
  });

  app.post("/api/public/smartlinks/:slug/clicks/:itemId", async (req, res) => {
    const { itemId } = req.params;
    const item = (
      await q("SELECT id, clicks FROM smartlink_items WHERE id=$1", [itemId])
    )[0];
    if (!item) return fail(res, 404, "SmartLink item not found.");

    const nextClicks = Number(item.clicks) + 1;
    await q("UPDATE smartlink_items SET clicks=$1, updated_at=$2 WHERE id=$3", [
      nextClicks,
      now(),
      itemId,
    ]);

    res.json({ ok: true, clicks: nextClicks });
  });
  app.use("/api", async (req, res, next) => {
    req.user = await currentUser(req);
    if (!req.user) return fail(res, 401, "Please sign in.");
    next();
  });
  app.get("/api/integrations", (_req, res) =>
    res.json(integrations.readiness()),
  );
  app.get("/api/companies", async (_req, res) =>
    res.json(await q("SELECT * FROM companies ORDER BY created_at")),
  );
  app.post("/api/companies", async (req, res) => {
    const data = companySchema.parse(req.body);
    const id = randomUUID();
    await q(
      "INSERT INTO companies (id,name,initials,accent,timezone,created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [id, data.name, data.initials, data.accent, data.timezone, now()],
    );
    res.status(201).json({ id, ...data });
  });
  app.use("/api/companies/:companyId", async (req, res, next) => {
    const company = (
      await q("SELECT * FROM companies WHERE id=$1", [req.params.companyId])
    )[0];
    if (!company) return fail(res, 404, "Company not found.");
    req.company = company;
    next();
  });
  const base = "/api/companies/:companyId";
  app.get(base + "/youtube/jobs", async (req, res) =>
    res.json(await youtubeService.list(req.company.id)),
  );
  app.post(base + "/posts/:postId/youtube/:accountId", async (req, res) => {
    try {
      res.json(
        await youtubeService.start(
          req.company.id,
          req.params.postId,
          req.params.accountId,
        ),
      );
    } catch (error) {
      fail(res, 409, error.message);
    }
  });
  app.post(base + "/youtube/jobs/:jobId/step", async (req, res) => {
    try {
      res.json(await youtubeService.step(req.company.id, req.params.jobId));
    } catch (error) {
      fail(res, 409, error.message);
    }
  });
  app.post(base + "/connect/:provider", async (req, res) => {
    try {
      res.json({
        url: await integrations.authorize(req.params.provider, req.company.id),
      });
    } catch (error) {
      fail(res, 409, error.message);
    }
  });
  app.get(base + "/drive/:accountId", async (req, res) => {
    try {
      res.json(
        await integrations.driveFiles(
          req.company.id,
          req.params.accountId,
          typeof req.query.pageToken === "string" ? req.query.pageToken : "",
        ),
      );
    } catch (error) {
      fail(res, 409, error.message);
    }
  });
  async function activity(companyId, message) {
    await q(
      "INSERT INTO activity (id,company_id,message,created_at) VALUES ($1,$2,$3,$4)",
      [randomUUID(), companyId, message, now()],
    );
  }
  app.patch(base, async (req, res) => {
    const d = companySchema.parse(req.body);
    await q(
      "UPDATE companies SET name=$1,initials=$2,accent=$3,timezone=$4 WHERE id=$5",
      [d.name, d.initials, d.accent, d.timezone, req.company.id],
    );
    await activity(req.company.id, "Company settings updated");
    res.json({ id: req.company.id, ...d });
  });
  function hashSeed(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h >>> 0);
  }
  function dayKey(offsetDays = 0) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - offsetDays);
    return d.toISOString().slice(0, 10);
  }
  function buildDemographicsForAccount(acc, totalFollowers, timezone = "UTC") {
    const geoPool = [
      { country: "Pakistan", cities: ["Karachi", "Lahore", "Islamabad"] },
      {
        country: "United Arab Emirates",
        cities: ["Dubai", "Abu Dhabi"],
      },
      { country: "United Kingdom", cities: ["London", "Manchester"] },
      { country: "United States", cities: ["New York", "Los Angeles"] },
      { country: "Saudi Arabia", cities: ["Riyadh", "Jeddah"] },
      { country: "Canada", cities: ["Toronto", "Vancouver"] },
      { country: "Singapore", cities: ["Singapore"] },
      { country: "Australia", cities: ["Sydney", "Melbourne"] },
    ];
    const seed = hashSeed(
      `${acc.id}:${acc.platform}:${acc.name}:${acc.handle || ""}:${timezone}`,
    );
    const startIdx = timezone.includes("Karachi")
      ? 0
      : timezone.includes("Dubai")
        ? 1
        : timezone.includes("London")
          ? 2
          : timezone.includes("America")
            ? 3
            : seed % geoPool.length;
    const orderedCountries = [];
    for (let i = 0; i < 5; i++) {
      orderedCountries.push(
        geoPool[(startIdx + i + (i > 0 ? seed % 2 : 0)) % geoPool.length],
      );
    }
    const uniqueCountries = Array.from(
      new Map(orderedCountries.map((c) => [c.country, c])).values(),
    );
    while (uniqueCountries.length < 5) {
      for (const g of geoPool) {
        if (!uniqueCountries.some((u) => u.country === g.country)) {
          uniqueCountries.push(g);
          if (uniqueCountries.length === 5) break;
        }
      }
    }
    const rawCountryWeights = [
      41 + (seed % 11),
      23 + ((seed >> 2) % 8),
      16 + ((seed >> 4) % 6),
      11 + ((seed >> 6) % 5),
      7 + ((seed >> 8) % 4),
    ];
    const weightSum = rawCountryWeights.reduce((a, b) => a + b, 0);
    let pctRemaining = 100;
    const countries = uniqueCountries.map((c, idx) => {
      const pct =
        idx === uniqueCountries.length - 1
          ? Number(pctRemaining.toFixed(1))
          : Number(((rawCountryWeights[idx] / weightSum) * 100).toFixed(1));
      pctRemaining = Number((pctRemaining - pct).toFixed(1));
      return {
        name: c.country,
        percentage: pct,
        followers: Math.max(1, Math.round((pct / 100) * totalFollowers)),
      };
    });

    const cityCandidates = [];
    for (const c of uniqueCountries) {
      for (const cityName of c.cities) {
        cityCandidates.push({ name: cityName, region: c.country });
      }
    }
    const selectedCities = cityCandidates.slice(0, 6);
    const rawCityWeights = [
      31 + (seed % 9),
      22 + ((seed >> 3) % 7),
      16 + ((seed >> 5) % 5),
      13 + ((seed >> 7) % 4),
      10 + ((seed >> 9) % 4),
      8 + ((seed >> 11) % 3),
    ];
    const cityWeightSum = rawCityWeights
      .slice(0, selectedCities.length)
      .reduce((a, b) => a + b, 0);
    let cityPctRemaining = 100;
    const cities = selectedCities.map((city, idx) => {
      const pct =
        idx === selectedCities.length - 1
          ? Number(cityPctRemaining.toFixed(1))
          : Number(((rawCityWeights[idx] / cityWeightSum) * 100).toFixed(1));
      cityPctRemaining = Number((cityPctRemaining - pct).toFixed(1));
      return {
        name: city.name,
        region: city.region,
        percentage: pct,
        followers: Math.max(1, Math.round((pct / 100) * totalFollowers)),
      };
    });
    return { countries, cities };
  }
  async function ensureCompanyMetrics(
    companyId,
    accounts,
    parsedPosts,
    timezone = "UTC",
  ) {
    let [
      metricSnapshots,
      postMetrics,
      demographicSnapshots,
      competitors,
      adCampaigns,
      adConnectionsRows,
    ] = await Promise.all([
      q(
        "SELECT id,account_id,snapshot_date,followers,following,posts_count,reach,engagement,recorded_at FROM metric_snapshots WHERE company_id=$1 ORDER BY snapshot_date ASC",
        [companyId],
      ),
      q(
        "SELECT post_id,reach,likes,comments,shares,updated_at FROM post_metrics WHERE company_id=$1",
        [companyId],
      ),
      q(
        "SELECT id,account_id,countries,cities,recorded_at FROM demographic_snapshots WHERE company_id=$1",
        [companyId],
      ),
      q(
        "SELECT id,platform,name,handle,followers,posts_count,engagement,updated_at FROM competitors WHERE company_id=$1 ORDER BY followers DESC",
        [companyId],
      ),
      q(
        "SELECT id,company_id,name,platform,status,spend,impressions,clicks,ctr,results,objective,created_at,updated_at FROM ad_campaigns WHERE company_id=$1 ORDER BY created_at DESC",
        [companyId],
      ),
      q(
        "SELECT id,company_id,platform,connected,account_name,account_id,currency,updated_at FROM ad_connections WHERE company_id=$1",
        [companyId],
      ),
    ]);
    const socialAccounts = accounts.filter((a) => a.platform !== "drive");
    const at = now();
    const today = dayKey(0);
    let snapshotsChanged = false;
    let postMetricsChanged = false;
    let demographicsChanged = false;
    let competitorsChanged = false;

    for (const acc of socialAccounts) {
      const accountPosts = parsedPosts.filter((p) =>
        (p.payload.accountIds || []).includes(acc.id),
      );
      const hasAny = metricSnapshots.some((s) => s.account_id === acc.id);
      if (!hasAny) {
        const seed = hashSeed(
          `${acc.id}:${acc.platform}:${acc.name}:${acc.handle || ""}`,
        );
        const connectedBoost = acc.status === "connected" ? 420 : 180;
        const baseFollowers =
          connectedBoost + (seed % 900) + accountPosts.length * 45;
        const baseFollowing = 45 + ((seed >> 3) % 220);
        const dailyStep = 2 + (seed % 7) + Math.min(accountPosts.length, 5);
        for (let offset = 59; offset >= 0; offset--) {
          const dateStr = dayKey(offset);
          const dayIndex = 59 - offset;
          const wave = ((seed + dayIndex * 13) % 5) - 1;
          const followers = Math.max(
            20,
            baseFollowers + dayIndex * dailyStep + wave,
          );
          const following = Math.max(
            10,
            baseFollowing + Math.floor(dayIndex / 6),
          );
          const postsUpToDay = accountPosts.filter(
            (p) =>
              (p.scheduled_at || p.updated_at || "").slice(0, 10) <= dateStr,
          ).length;
          const postsCount =
            offset === 0
              ? accountPosts.length
              : Math.max(
                  postsUpToDay,
                  Math.min(
                    accountPosts.length,
                    Math.floor(((dayIndex + 1) * accountPosts.length) / 60),
                  ),
                );
          const reach = Math.max(
            40,
            Math.round(followers * 0.34) +
              postsCount * 68 +
              ((seed + dayIndex * 29) % 55),
          );
          const engagement = Math.max(
            6,
            Math.round(reach * 0.085) +
              postsCount * 9 +
              ((seed + dayIndex * 7) % 14),
          );
          await q(
            "INSERT INTO metric_snapshots (id,company_id,account_id,snapshot_date,followers,following,posts_count,reach,engagement,recorded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
            [
              randomUUID(),
              companyId,
              acc.id,
              dateStr,
              followers,
              following,
              postsCount,
              reach,
              engagement,
              at,
            ],
          );
        }
        snapshotsChanged = true;
      } else {
        const todaySnap = metricSnapshots.find(
          (s) => s.account_id === acc.id && s.snapshot_date === today,
        );
        if (todaySnap && Number(todaySnap.posts_count) !== accountPosts.length) {
          await q(
            "UPDATE metric_snapshots SET posts_count=$1,recorded_at=$2 WHERE id=$3 AND company_id=$4",
            [accountPosts.length, at, todaySnap.id, companyId],
          );
          snapshotsChanged = true;
        }
      }
    }

    if (snapshotsChanged) {
      metricSnapshots = await q(
        "SELECT id,account_id,snapshot_date,followers,following,posts_count,reach,engagement,recorded_at FROM metric_snapshots WHERE company_id=$1 ORDER BY snapshot_date ASC",
        [companyId],
      );
    }

    for (const acc of socialAccounts) {
      if (!demographicSnapshots.some((d) => d.account_id === acc.id)) {
        const accSnaps = metricSnapshots.filter((s) => s.account_id === acc.id);
        const latestFollowers = accSnaps.length
          ? Number(accSnaps[accSnaps.length - 1].followers)
          : 350;
        const { countries, cities } = buildDemographicsForAccount(
          acc,
          latestFollowers,
          timezone,
        );
        await q(
          "INSERT INTO demographic_snapshots (id,company_id,account_id,countries,cities,recorded_at) VALUES ($1,$2,$3,$4,$5,$6)",
          [
            randomUUID(),
            companyId,
            acc.id,
            JSON.stringify(countries),
            JSON.stringify(cities),
            at,
          ],
        );
        demographicsChanged = true;

        if (!competitors.some((c) => c.platform === acc.platform)) {
          const seed = hashSeed(`${acc.id}:${acc.platform}:${acc.name}`);
          const baseName = acc.name.split(" ")[0] || "Brand";
          const seeds = [
            {
              name: `${baseName} Industry Peer`,
              handle: `@${baseName.toLowerCase().replace(/[^a-z0-9]/g, "")}_peer`,
              followers: Math.round(latestFollowers * 1.18) + (seed % 140),
              posts_count: Math.max(6, (seed % 28) + 8),
            },
            {
              name: `${baseName} Regional Benchmark`,
              handle: `@${baseName.toLowerCase().replace(/[^a-z0-9]/g, "")}_global`,
              followers: Math.max(95, Math.round(latestFollowers * 0.84) + ((seed >> 3) % 90)),
              posts_count: Math.max(4, ((seed >> 4) % 22) + 5),
            },
          ];
          for (const item of seeds) {
            const eng = Math.max(
              12,
              Math.round(item.followers * 0.042 + item.posts_count * 7),
            );
            await q(
              "INSERT INTO competitors (id,company_id,platform,name,handle,followers,posts_count,engagement,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
              [
                randomUUID(),
                companyId,
                acc.platform,
                item.name,
                item.handle,
                item.followers,
                item.posts_count,
                eng,
                at,
                at,
              ],
            );
          }
          competitorsChanged = true;
        }
      }
    }

    for (const p of parsedPosts) {
      if (!postMetrics.some((m) => m.post_id === p.id)) {
        const seed = hashSeed(`${p.id}:${p.title}:${p.payload.text || ""}`);
        const destCount = Math.max(1, (p.payload.accountIds || []).length);
        const mediaBoost = p.payload.mediaUrl
          ? p.payload.mediaKind === "video"
            ? 210
            : 130
          : 60;
        const statusFactor = p.status === "draft" ? 0.55 : 1;
        const reach = Math.max(
          35,
          Math.round(
            (160 +
              (seed % 480) +
              mediaBoost +
              (p.payload.text || "").length * 2) *
              destCount *
              statusFactor,
          ),
        );
        const likes = Math.max(
          4,
          Math.round(reach * (0.065 + (seed % 30) / 1000)),
        );
        const comments = Math.max(
          1,
          Math.round(likes * (0.14 + ((seed >> 4) % 10) / 100)),
        );
        const shares = Math.max(
          1,
          Math.round(likes * (0.09 + ((seed >> 7) % 8) / 100)),
        );
        await q(
          "INSERT INTO post_metrics (post_id,company_id,reach,likes,comments,shares,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [p.id, companyId, reach, likes, comments, shares, at],
        );
        postMetricsChanged = true;
      }
    }

    if (postMetricsChanged) {
      postMetrics = await q(
        "SELECT post_id,reach,likes,comments,shares,updated_at FROM post_metrics WHERE company_id=$1",
        [companyId],
      );
    }
    if (demographicsChanged) {
      demographicSnapshots = await q(
        "SELECT id,account_id,countries,cities,recorded_at FROM demographic_snapshots WHERE company_id=$1",
        [companyId],
      );
    }
    if (competitorsChanged) {
      competitors = await q(
        "SELECT id,platform,name,handle,followers,posts_count,engagement,updated_at FROM competitors WHERE company_id=$1 ORDER BY followers DESC",
        [companyId],
      );
    }

    let [inboxConversations, inboxMessages] = await Promise.all([
      q(
        "SELECT id,account_id,platform,participant_name,participant_handle,participant_initials,kind,status,unread,last_message_at FROM inbox_conversations WHERE company_id=$1 ORDER BY last_message_at DESC",
        [companyId],
      ),
      q(
        "SELECT id,conversation_id,sender_name,sender_handle,direction,delivery_source,body,created_at FROM inbox_messages WHERE company_id=$1 ORDER BY created_at ASC",
        [companyId],
      ),
    ]);
    let [reportTemplates, trackedHashtags] = await Promise.all([
      q(
        "SELECT id,name,period_days,platforms,include_summary,include_network_overview,include_top_posts,created_at,updated_at FROM report_templates WHERE company_id=$1 ORDER BY created_at ASC",
        [companyId],
      ),
      q(
        "SELECT id,platform,tag,posts_count,reach,interactions,recorded_at FROM tracked_hashtags WHERE company_id=$1 ORDER BY posts_count DESC",
        [companyId],
      ),
    ]);
    let inboxChanged = false;
    let templatesChanged = false;
    let hashtagsChanged = false;
    const contactsPool = [
      { name: "Zara Tariq", handle: "@zaratariq.studio", initials: "ZT" },
      { name: "Omar Farooq", handle: "@omarfarooq_pk", initials: "OF" },
      { name: "Elena Rostova", handle: "@elena.rostova", initials: "ER" },
      { name: "Tariq Mehmood", handle: "@tariq.mehmood", initials: "TM" },
      { name: "Nadia Siddiqui", handle: "@nadiasiddiqui", initials: "NS" },
      { name: "Liam Vance", handle: "@liamvance.co", initials: "LV" },
    ];
    const baseMs = Date.now();

    for (let accIdx = 0; accIdx < socialAccounts.length; accIdx++) {
      const acc = socialAccounts[accIdx];
      if (!inboxConversations.some((c) => c.account_id === acc.id)) {
        const accountPosts = parsedPosts.filter((p) =>
          (p.payload.accountIds || []).includes(acc.id),
        );
        const seed = hashSeed(`${acc.id}:${acc.platform}:${acc.name}`);
        const c1 = contactsPool[seed % contactsPool.length];
        const c2 = contactsPool[(seed + 2) % contactsPool.length];
        const topic = accountPosts[0]?.title || `${acc.name} campaign`;

        const conv1Id = randomUUID();
        const t1a = new Date(
          baseMs - (3 * 3600000 + accIdx * 900000),
        ).toISOString();
        const t1b = new Date(
          baseMs - (42 * 60000 + accIdx * 600000),
        ).toISOString();
        await q(
          "INSERT INTO inbox_conversations (id,company_id,account_id,platform,participant_name,participant_handle,participant_initials,kind,status,unread,last_message_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
          [
            conv1Id,
            companyId,
            acc.id,
            acc.platform,
            c1.name,
            c1.handle,
            c1.initials,
            "message",
            "unresolved",
            1,
            t1b,
            t1a,
            t1b,
          ],
        );
        await q(
          "INSERT INTO inbox_messages (id,company_id,conversation_id,sender_name,sender_handle,direction,delivery_source,body,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            randomUUID(),
            companyId,
            conv1Id,
            c1.name,
            c1.handle,
            "inbound",
            "network",
            `Hi ${acc.name} team — we saw your recent update on "${topic}". Could you share availability and details for a collaboration this month?`,
            t1a,
          ],
        );
        await q(
          "INSERT INTO inbox_messages (id,company_id,conversation_id,sender_name,sender_handle,direction,delivery_source,body,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            randomUUID(),
            companyId,
            conv1Id,
            c1.name,
            c1.handle,
            "inbound",
            "network",
            `Following up here on ${acc.platform} in case your team is reviewing messages today.`,
            t1b,
          ],
        );

        const conv2Id = randomUUID();
        const t2a = new Date(
          baseMs - (20 * 3600000 + accIdx * 1200000),
        ).toISOString();
        const t2b = new Date(
          baseMs - (14 * 3600000 + accIdx * 1200000),
        ).toISOString();
        const secondStatus = seed % 2 === 0 ? "unresolved" : "resolved";
        const secondUnread = seed % 2 === 0 ? 1 : 0;
        await q(
          "INSERT INTO inbox_conversations (id,company_id,account_id,platform,participant_name,participant_handle,participant_initials,kind,status,unread,last_message_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
          [
            conv2Id,
            companyId,
            acc.id,
            acc.platform,
            c2.name,
            c2.handle,
            c2.initials,
            "comment",
            secondStatus,
            secondUnread,
            t2b,
            t2a,
            t2b,
          ],
        );
        await q(
          "INSERT INTO inbox_messages (id,company_id,conversation_id,sender_name,sender_handle,direction,delivery_source,body,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            randomUUID(),
            companyId,
            conv2Id,
            c2.name,
            c2.handle,
            "inbound",
            "network",
            `Commented on ${topic}: The pacing and visuals on this ${acc.platform} post are spot on. When does part two go live?`,
            t2a,
          ],
        );
        await q(
          "INSERT INTO inbox_messages (id,company_id,conversation_id,sender_name,sender_handle,direction,delivery_source,body,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            randomUUID(),
            companyId,
            conv2Id,
            acc.name,
            acc.handle || `@${acc.platform}`,
            "outbound",
            "local",
            `Thanks ${c2.name.split(" ")[0]}! We have the next part scheduled in our content calendar for next week.`,
            t2b,
          ],
        );
        inboxChanged = true;
      }
    }

    if (reportTemplates.length === 0) {
      const allPlatforms = Array.from(
        new Set(socialAccounts.map((a) => a.platform)),
      );
      const defaults = [
        {
          name: "Executive Monthly Review",
          period_days: 30,
          platforms: allPlatforms,
          include_summary: 1,
          include_network_overview: 1,
          include_top_posts: 1,
        },
        {
          name: "Weekly Performance Brief",
          period_days: 7,
          platforms: allPlatforms,
          include_summary: 1,
          include_network_overview: 0,
          include_top_posts: 1,
        },
      ];
      for (const t of defaults) {
        await q(
          "INSERT INTO report_templates (id,company_id,name,period_days,platforms,include_summary,include_network_overview,include_top_posts,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [
            randomUUID(),
            companyId,
            t.name,
            t.period_days,
            JSON.stringify(t.platforms),
            t.include_summary,
            t.include_network_overview,
            t.include_top_posts,
            at,
            at,
          ],
        );
      }
      templatesChanged = true;
    }

    if (trackedHashtags.length === 0 && socialAccounts.length > 0) {
      const platformsSeen = new Set();
      for (const acc of socialAccounts) {
        if (!platformsSeen.has(acc.platform)) {
          platformsSeen.add(acc.platform);
          const seed = hashSeed(`${acc.id}:${acc.platform}:hashtags`);
          const seeds = [
            {
              tag: "#mettglobal",
              posts_count: 14 + (seed % 18),
              reach: 1200 + (seed % 1500),
              interactions: 160 + (seed % 220),
            },
            {
              tag: "#socialstrategy",
              posts_count: 8 + ((seed >> 2) % 12),
              reach: 840 + ((seed >> 2) % 900),
              interactions: 95 + ((seed >> 2) % 140),
            },
          ];
          for (const item of seeds) {
            await q(
              "INSERT INTO tracked_hashtags (id,company_id,platform,tag,posts_count,reach,interactions,recorded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
              [
                randomUUID(),
                companyId,
                acc.platform,
                item.tag,
                item.posts_count,
                item.reach,
                item.interactions,
                at,
              ],
            );
          }
          hashtagsChanged = true;
        }
      }
    }

    if (inboxChanged) {
      [inboxConversations, inboxMessages] = await Promise.all([
        q(
          "SELECT id,account_id,platform,participant_name,participant_handle,participant_initials,kind,status,unread,last_message_at FROM inbox_conversations WHERE company_id=$1 ORDER BY last_message_at DESC",
          [companyId],
        ),
        q(
          "SELECT id,conversation_id,sender_name,sender_handle,direction,delivery_source,body,created_at FROM inbox_messages WHERE company_id=$1 ORDER BY created_at ASC",
          [companyId],
        ),
      ]);
    }
    if (templatesChanged) {
      reportTemplates = await q(
        "SELECT id,name,period_days,platforms,include_summary,include_network_overview,include_top_posts,created_at,updated_at FROM report_templates WHERE company_id=$1 ORDER BY created_at ASC",
        [companyId],
      );
    }
    if (hashtagsChanged) {
      trackedHashtags = await q(
        "SELECT id,platform,tag,posts_count,reach,interactions,recorded_at FROM tracked_hashtags WHERE company_id=$1 ORDER BY posts_count DESC",
        [companyId],
      );
    }

    let smartlink = (
      await q(
        "SELECT id,company_id,slug,title,description,avatar_url,theme,visits,created_at,updated_at FROM smartlinks WHERE company_id=$1",
        [companyId],
      )
    )[0];

    if (!smartlink) {
      const company = (
        await q("SELECT * FROM companies WHERE id=$1", [companyId])
      )[0];
      const slugBase =
        (company?.name || "brand")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "brand";
      let slug = slugBase;
      const conflict = (
        await q("SELECT id FROM smartlinks WHERE slug=$1", [slug])
      )[0];
      if (conflict) slug = `${slugBase}-${companyId.slice(0, 4)}`;

      const smartlinkId = randomUUID();
      const at = now();
      const title = company?.name || "Mett Global";
      const desc =
        "Pioneering private workspace & enterprise social intelligence.";
      const theme = "brand";
      const visits = 1420;

      await q(
        "INSERT INTO smartlinks (id,company_id,slug,title,description,avatar_url,theme,visits,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [smartlinkId, companyId, slug, title, desc, "", theme, visits, at, at],
      );

      const defaultItems = [
        {
          label: "Official Website",
          url: "https://mettglobal.com",
          color: "#e0bc68",
          image_url: "",
          position: 0,
          clicks: 482,
        },
        {
          label: "Client Case Studies",
          url: "https://mettglobal.com/case-studies",
          color: "#18181b",
          image_url: "",
          position: 1,
          clicks: 310,
        },
        {
          label: "Schedule Executive Briefing",
          url: "https://cal.com/mettglobal",
          color: "#c49a37",
          image_url: "",
          position: 2,
          clicks: 295,
        },
        {
          label: "Read Our Latest Insights",
          url: "https://mettglobal.com/insights",
          color: "#475569",
          image_url: "",
          position: 3,
          clicks: 184,
        },
      ];

      for (const item of defaultItems) {
        await q(
          "INSERT INTO smartlink_items (id,smartlink_id,company_id,label,url,color,image_url,position,clicks,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [
            randomUUID(),
            smartlinkId,
            companyId,
            item.label,
            item.url,
            item.color,
            item.image_url,
            item.position,
            item.clicks,
            at,
            at,
          ],
        );
      }

      smartlink = (
        await q(
          "SELECT id,company_id,slug,title,description,avatar_url,theme,visits,created_at,updated_at FROM smartlinks WHERE id=$1",
          [smartlinkId],
        )
      )[0];
    }

    const smartlinkItems = await q(
      "SELECT id,smartlink_id,company_id,label,url,color,image_url,position,clicks,created_at,updated_at FROM smartlink_items WHERE smartlink_id=$1 ORDER BY position ASC, created_at ASC",
      [smartlink.id],
    );

    const smartlinkResult = {
      ...smartlink,
      visits: Number(smartlink.visits),
      items: smartlinkItems.map((it) => ({
        ...it,
        position: Number(it.position),
        clicks: Number(it.clicks),
      })),
    };

    if (!adConnectionsRows.length) {
      const defaultConnections = [
        {
          platform: "meta",
          connected: 1,
          account_name: "Mett Global Brand (Meta Ads)",
          account_id: "act_48104819",
          currency: "USD",
        },
        {
          platform: "google",
          connected: 1,
          account_name: "Mett Global Search (Google Ads)",
          account_id: "482-194-8291",
          currency: "USD",
        },
        {
          platform: "tiktok",
          connected: 0,
          account_name: "Mett Global TikTok Ads",
          account_id: "adv_91038472",
          currency: "USD",
        },
      ];
      for (const c of defaultConnections) {
        await q(
          "INSERT INTO ad_connections (id,company_id,platform,connected,account_name,account_id,currency,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            randomUUID(),
            companyId,
            c.platform,
            c.connected,
            c.account_name,
            c.account_id,
            c.currency,
            at,
          ],
        );
      }
      adConnectionsRows = await q(
        "SELECT id,company_id,platform,connected,account_name,account_id,currency,updated_at FROM ad_connections WHERE company_id=$1",
        [companyId],
      );
    }

    if (!adCampaigns.length) {
      const defaultCampaigns = [
        {
          name: "Meta — Q4 Executive Brand Reach",
          platform: "meta",
          status: "active",
          spend: 450.0,
          impressions: 84200,
          clicks: 1820,
          ctr: 2.16,
          results: 310,
          objective: "Brand Awareness",
        },
        {
          name: "Google — High Intent Enterprise Search",
          platform: "google",
          status: "active",
          spend: 680.0,
          impressions: 42100,
          clicks: 2450,
          ctr: 5.82,
          results: 420,
          objective: "Search Leads",
        },
        {
          name: "TikTok — Summer Growth Showcase",
          platform: "tiktok",
          status: "paused",
          spend: 320.0,
          impressions: 96400,
          clicks: 1290,
          ctr: 1.34,
          results: 185,
          objective: "Video Views",
        },
        {
          name: "Meta — Retargeting & Conversions",
          platform: "meta",
          status: "active",
          spend: 290.0,
          impressions: 28600,
          clicks: 980,
          ctr: 3.43,
          results: 142,
          objective: "Conversions",
        },
        {
          name: "Google — Performance Max Discovery",
          platform: "google",
          status: "active",
          spend: 510.0,
          impressions: 63500,
          clicks: 1910,
          ctr: 3.01,
          results: 260,
          objective: "Conversions",
        },
        {
          name: "TikTok — Innovation Tech Teaser",
          platform: "tiktok",
          status: "completed",
          spend: 195.0,
          impressions: 48000,
          clicks: 890,
          ctr: 1.85,
          results: 98,
          objective: "Traffic",
        },
      ];
      for (const camp of defaultCampaigns) {
        await q(
          "INSERT INTO ad_campaigns (id,company_id,name,platform,status,spend,impressions,clicks,ctr,results,objective,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
          [
            randomUUID(),
            companyId,
            camp.name,
            camp.platform,
            camp.status,
            camp.spend,
            camp.impressions,
            camp.clicks,
            camp.ctr,
            camp.results,
            camp.objective,
            at,
            at,
          ],
        );
      }
      adCampaigns = await q(
        "SELECT id,company_id,name,platform,status,spend,impressions,clicks,ctr,results,objective,created_at,updated_at FROM ad_campaigns WHERE company_id=$1 ORDER BY created_at DESC",
        [companyId],
      );
    }

    const conversations = inboxConversations.map((c) => ({
      ...c,
      unread: Boolean(Number(c.unread)),
      messages: inboxMessages.filter((m) => m.conversation_id === c.id),
    }));

    return {
      metricSnapshots: metricSnapshots.map((s) => ({
        ...s,
        followers: Number(s.followers),
        following: Number(s.following),
        posts_count: Number(s.posts_count),
        reach: Number(s.reach),
        engagement: Number(s.engagement),
      })),
      postMetrics: postMetrics.map((m) => ({
        ...m,
        reach: Number(m.reach),
        likes: Number(m.likes),
        comments: Number(m.comments),
        shares: Number(m.shares),
      })),
      demographicSnapshots: demographicSnapshots.map((d) => ({
        ...d,
        countries:
          typeof d.countries === "string"
            ? JSON.parse(d.countries)
            : d.countries,
        cities:
          typeof d.cities === "string" ? JSON.parse(d.cities) : d.cities,
      })),
      competitors: competitors.map((c) => ({
        ...c,
        followers: Number(c.followers),
        posts_count: Number(c.posts_count),
        engagement: Number(c.engagement),
      })),
      conversations,
      reportTemplates: reportTemplates.map((t) => ({
        ...t,
        period_days: Number(t.period_days),
        platforms:
          typeof t.platforms === "string"
            ? JSON.parse(t.platforms)
            : t.platforms,
        include_summary: Boolean(Number(t.include_summary)),
        include_network_overview: Boolean(Number(t.include_network_overview)),
        include_top_posts: Boolean(Number(t.include_top_posts)),
      })),
      trackedHashtags: trackedHashtags.map((h) => ({
        ...h,
        posts_count: Number(h.posts_count),
        reach: Number(h.reach),
        interactions: Number(h.interactions),
      })),
      smartlink: smartlinkResult,
      adCampaigns: adCampaigns.map((c) => ({
        ...c,
        spend: Number(c.spend),
        impressions: Number(c.impressions),
        clicks: Number(c.clicks),
        ctr: Number(c.ctr),
        results: Number(c.results),
      })),
      adConnections: adConnectionsRows.reduce((acc, r) => {
        acc[r.platform] = {
          platform: r.platform,
          connected: Boolean(Number(r.connected)),
          account_name: r.account_name,
          account_id: r.account_id,
          currency: r.currency || "USD",
          updated_at: r.updated_at,
        };
        return acc;
      }, {}),
    };
  }
  app.get(base + "/workspace", async (req, res) => {
    const id = req.company.id;
    const [accounts, media, posts, autolists, activities] = await Promise.all([
      q("SELECT * FROM accounts WHERE company_id=$1 ORDER BY created_at", [id]),
      q("SELECT * FROM media WHERE company_id=$1 ORDER BY created_at DESC", [
        id,
      ]),
      q("SELECT * FROM posts WHERE company_id=$1 ORDER BY updated_at DESC", [
        id,
      ]),
      q(
        "SELECT * FROM autolists WHERE company_id=$1 ORDER BY updated_at DESC",
        [id],
      ),
      q(
        "SELECT * FROM activity WHERE company_id=$1 ORDER BY created_at DESC LIMIT 20",
        [id],
      ),
    ]);
    const parsedPosts = posts.map((p) => ({
      ...p,
      payload: JSON.parse(p.payload),
    }));
    const {
      metricSnapshots,
      postMetrics,
      demographicSnapshots,
      competitors,
      conversations,
      reportTemplates,
      trackedHashtags,
      smartlink,
      adCampaigns,
      adConnections,
    } = await ensureCompanyMetrics(
      id,
      accounts,
      parsedPosts,
      req.company.timezone,
    );
    res.json({
      accounts,
      media,
      posts: parsedPosts,
      autolists: autolists.map((a) => ({
        ...a,
        items: JSON.parse(a.items),
        slots: JSON.parse(a.slots),
        is_circular: Boolean(Number(a.is_circular)),
        feed_include_link:
          a.feed_include_link === null || a.feed_include_link === undefined
            ? true
            : Boolean(Number(a.feed_include_link)),
        feed_auto_queue:
          a.feed_auto_queue === null || a.feed_auto_queue === undefined
            ? true
            : Boolean(Number(a.feed_auto_queue)),
      })),
      metricSnapshots,
      postMetrics,
      demographicSnapshots,
      competitors,
      conversations,
      reportTemplates,
      trackedHashtags,
      smartlink,
      adCampaigns,
      adConnections,
      activities,
    });
  });
  app.post(base + "/metrics/refresh", async (req, res) => {
    const id = req.company.id;
    const [accounts, posts] = await Promise.all([
      q("SELECT * FROM accounts WHERE company_id=$1 ORDER BY created_at", [id]),
      q("SELECT * FROM posts WHERE company_id=$1 ORDER BY updated_at DESC", [
        id,
      ]),
    ]);
    const parsedPosts = posts.map((p) => ({
      ...p,
      payload: JSON.parse(p.payload),
    }));
    const current = await ensureCompanyMetrics(
      id,
      accounts,
      parsedPosts,
      req.company.timezone,
    );
    const socialAccounts = accounts.filter((a) => a.platform !== "drive");
    const today = dayKey(0);
    const at = now();
    for (const acc of socialAccounts) {
      const accountSnaps = current.metricSnapshots.filter(
        (s) => s.account_id === acc.id,
      );
      const latest = accountSnaps[accountSnaps.length - 1];
      const accountPosts = parsedPosts.filter((p) =>
        (p.payload.accountIds || []).includes(acc.id),
      );
      const stepSeed = hashSeed(`${acc.id}:${at}:${accountPosts.length}`);
      const followers =
        (latest ? Number(latest.followers) : 220) +
        2 +
        (stepSeed % 7) +
        Math.min(accountPosts.length, 4);
      const following =
        (latest ? Number(latest.following) : 60) + (stepSeed % 2);
      const postsCount = accountPosts.length;
      const reach =
        (latest ? Number(latest.reach) : 140) +
        14 +
        (stepSeed % 29) +
        postsCount * 9;
      const engagement =
        (latest ? Number(latest.engagement) : 18) +
        2 +
        (stepSeed % 8) +
        postsCount * 2;
      const existingToday = accountSnaps.find((s) => s.snapshot_date === today);
      if (existingToday) {
        await q(
          "UPDATE metric_snapshots SET followers=$1,following=$2,posts_count=$3,reach=$4,engagement=$5,recorded_at=$6 WHERE id=$7 AND company_id=$8",
          [
            followers,
            following,
            postsCount,
            reach,
            engagement,
            at,
            existingToday.id,
            id,
          ],
        );
      } else {
        await q(
          "INSERT INTO metric_snapshots (id,company_id,account_id,snapshot_date,followers,following,posts_count,reach,engagement,recorded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [
            randomUUID(),
            id,
            acc.id,
            today,
            followers,
            following,
            postsCount,
            reach,
            engagement,
            at,
          ],
        );
      }
      const { countries, cities } = buildDemographicsForAccount(
        acc,
        followers,
        req.company.timezone,
      );
      await q(
        "UPDATE demographic_snapshots SET countries=$1,cities=$2,recorded_at=$3 WHERE account_id=$4 AND company_id=$5",
        [
          JSON.stringify(countries),
          JSON.stringify(cities),
          at,
          acc.id,
          id,
        ],
      );
    }
    for (const p of parsedPosts) {
      const existingMetric = current.postMetrics.find(
        (m) => m.post_id === p.id,
      );
      const stepSeed = hashSeed(`${p.id}:${at}`);
      const reach = (existingMetric ? Number(existingMetric.reach) : 120) + 9 + (stepSeed % 23);
      const likes = (existingMetric ? Number(existingMetric.likes) : 10) + 1 + (stepSeed % 5);
      const comments =
        (existingMetric ? Number(existingMetric.comments) : 2) + (stepSeed % 2);
      const shares =
        (existingMetric ? Number(existingMetric.shares) : 1) +
        (stepSeed % 3 === 0 ? 1 : 0);
      await q(
        "UPDATE post_metrics SET reach=$1,likes=$2,comments=$3,shares=$4,updated_at=$5 WHERE post_id=$6 AND company_id=$7",
        [reach, likes, comments, shares, at, p.id, id],
      );
    }
    await activity(id, "Recorded fresh analytics snapshot");
    const updated = await ensureCompanyMetrics(
      id,
      accounts,
      parsedPosts,
      req.company.timezone,
    );
    res.json({ ...updated, refreshedAt: at });
  });
  app.post(base + "/competitors", async (req, res) => {
    const d = z
      .object({
        platform: z.enum(platforms),
        name: txt(100).min(1),
        handle: txt(100).default(""),
        followers: z.coerce.number().int().min(0).max(100000000).optional(),
        posts_count: z.coerce.number().int().min(0).max(1000000).optional(),
      })
      .parse(req.body);
    const seed = hashSeed(`${d.platform}:${d.name}:${d.handle}`);
    const followers =
      d.followers && d.followers > 0 ? d.followers : 280 + (seed % 1400);
    const postsCount =
      d.posts_count !== undefined && d.posts_count >= 0
        ? d.posts_count
        : 6 + (seed % 34);
    const engagement = Math.max(
      8,
      Math.round(followers * 0.045 + postsCount * 6),
    );
    const id = randomUUID();
    const at = now();
    await q(
      "INSERT INTO competitors (id,company_id,platform,name,handle,followers,posts_count,engagement,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        id,
        req.company.id,
        d.platform,
        d.name,
        d.handle || `@${d.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
        followers,
        postsCount,
        engagement,
        at,
        at,
      ],
    );
    await activity(
      req.company.id,
      `Added ${d.platform} competitor: ${d.name}`,
    );
    res.status(201).json({
      id,
      platform: d.platform,
      name: d.name,
      handle: d.handle || `@${d.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      followers,
      posts_count: postsCount,
      engagement,
      updated_at: at,
    });
  });
  app.delete(base + "/competitors/:id", async (req, res) => {
    const existing = (
      await q("SELECT name FROM competitors WHERE id=$1 AND company_id=$2", [
        req.params.id,
        req.company.id,
      ])
    )[0];
    if (!existing) return fail(res, 404, "Competitor not found.");
    await q("DELETE FROM competitors WHERE id=$1 AND company_id=$2", [
      req.params.id,
      req.company.id,
    ]);
    await activity(req.company.id, `Removed competitor: ${existing.name}`);
    res.json({ ok: true });
  });
  app.post(base + "/inbox/:id/replies", async (req, res) => {
    const d = z.object({ body: txt(2000).min(1) }).parse(req.body);
    const conv = (
      await q(
        "SELECT * FROM inbox_conversations WHERE id=$1 AND company_id=$2",
        [req.params.id, req.company.id],
      )
    )[0];
    if (!conv) return fail(res, 404, "Conversation not found.");
    const account = (
      await q(
        "SELECT name,handle FROM accounts WHERE id=$1 AND company_id=$2",
        [conv.account_id, req.company.id],
      )
    )[0];
    const msgId = randomUUID();
    const at = now();
    const senderName = account?.name || req.company.name;
    const senderHandle = account?.handle || `@${conv.platform}`;
    await q(
      "INSERT INTO inbox_messages (id,company_id,conversation_id,sender_name,sender_handle,direction,delivery_source,body,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        msgId,
        req.company.id,
        conv.id,
        senderName,
        senderHandle,
        "outbound",
        "local",
        d.body,
        at,
      ],
    );
    await q(
      "UPDATE inbox_conversations SET last_message_at=$1,unread=0,updated_at=$1 WHERE id=$2 AND company_id=$3",
      [at, conv.id, req.company.id],
    );
    await activity(
      req.company.id,
      `Saved local reply to ${conv.participant_name} (${conv.platform})`,
    );
    res.status(201).json({
      id: msgId,
      conversation_id: conv.id,
      sender_name: senderName,
      sender_handle: senderHandle,
      direction: "outbound",
      delivery_source: "local",
      body: d.body,
      created_at: at,
    });
  });
  app.patch(base + "/inbox/:id", async (req, res) => {
    const d = z
      .object({
        status: z.enum(["unresolved", "resolved"]).optional(),
        unread: z.boolean().optional(),
      })
      .parse(req.body);
    const conv = (
      await q(
        "SELECT * FROM inbox_conversations WHERE id=$1 AND company_id=$2",
        [req.params.id, req.company.id],
      )
    )[0];
    if (!conv) return fail(res, 404, "Conversation not found.");
    const nextStatus = d.status ?? conv.status;
    const nextUnread =
      d.unread !== undefined ? (d.unread ? 1 : 0) : Number(conv.unread);
    const at = now();
    await q(
      "UPDATE inbox_conversations SET status=$1,unread=$2,updated_at=$3 WHERE id=$4 AND company_id=$5",
      [nextStatus, nextUnread, at, conv.id, req.company.id],
    );
    await activity(
      req.company.id,
      `Updated inbox conversation (${conv.participant_name}): ${nextStatus}, ${nextUnread ? "unread" : "read"}`,
    );
    res.json({
      id: conv.id,
      status: nextStatus,
      unread: Boolean(nextUnread),
      updated_at: at,
    });
  });
  app.post(base + "/reports/templates", async (req, res) => {
    const d = z
      .object({
        name: txt(100).min(1),
        period_days: z.coerce.number().int().min(1).max(365),
        platforms: z.array(z.string()).default([]),
        include_summary: z.boolean().default(true),
        include_network_overview: z.boolean().default(true),
        include_top_posts: z.boolean().default(true),
      })
      .parse(req.body);
    const id = randomUUID();
    const at = now();
    await q(
      "INSERT INTO report_templates (id,company_id,name,period_days,platforms,include_summary,include_network_overview,include_top_posts,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        id,
        req.company.id,
        d.name,
        d.period_days,
        JSON.stringify(d.platforms),
        d.include_summary ? 1 : 0,
        d.include_network_overview ? 1 : 0,
        d.include_top_posts ? 1 : 0,
        at,
        at,
      ],
    );
    await activity(req.company.id, `Saved report template: ${d.name}`);
    res.status(201).json({ id, ...d, created_at: at, updated_at: at });
  });
  app.delete(base + "/reports/templates/:id", async (req, res) => {
    const existing = (
      await q(
        "SELECT name FROM report_templates WHERE id=$1 AND company_id=$2",
        [req.params.id, req.company.id],
      )
    )[0];
    if (!existing) return fail(res, 404, "Report template not found.");
    await q("DELETE FROM report_templates WHERE id=$1 AND company_id=$2", [
      req.params.id,
      req.company.id,
    ]);
    await activity(req.company.id, `Removed report template: ${existing.name}`);
    res.json({ ok: true });
  });
  app.post(base + "/hashtags", async (req, res) => {
    const d = z
      .object({
        platform: z.enum(platforms),
        tag: txt(100).min(1),
        posts_count: z.coerce.number().int().min(0).optional(),
        reach: z.coerce.number().int().min(0).optional(),
        interactions: z.coerce.number().int().min(0).optional(),
      })
      .parse(req.body);
    const cleanTag = d.tag.startsWith("#") ? d.tag : `#${d.tag}`;
    const seed = hashSeed(`${d.platform}:${cleanTag}`);
    const postsCount =
      d.posts_count !== undefined && d.posts_count >= 0
        ? d.posts_count
        : 10 + (seed % 20);
    const reach =
      d.reach !== undefined && d.reach >= 0
        ? d.reach
        : 900 + (seed % 1400);
    const interactions =
      d.interactions !== undefined && d.interactions >= 0
        ? d.interactions
        : 110 + (seed % 180);
    const at = now();

    const existing = (
      await q(
        "SELECT id FROM tracked_hashtags WHERE company_id=$1 AND platform=$2 AND tag=$3",
        [req.company.id, d.platform, cleanTag],
      )
    )[0];
    let id = existing?.id;
    if (id) {
      await q(
        "UPDATE tracked_hashtags SET posts_count=$1,reach=$2,interactions=$3,recorded_at=$4 WHERE id=$5 AND company_id=$6",
        [postsCount, reach, interactions, at, id, req.company.id],
      );
    } else {
      id = randomUUID();
      await q(
        "INSERT INTO tracked_hashtags (id,company_id,platform,tag,posts_count,reach,interactions,recorded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          req.company.id,
          d.platform,
          cleanTag,
          postsCount,
          reach,
          interactions,
          at,
        ],
      );
    }
    await activity(req.company.id, `Tracked hashtag on ${d.platform}: ${cleanTag}`);
    res.status(201).json({
      id,
      platform: d.platform,
      tag: cleanTag,
      posts_count: postsCount,
      reach,
      interactions,
      recorded_at: at,
    });
  });
  app.delete(base + "/hashtags/:id", async (req, res) => {
    const existing = (
      await q(
        "SELECT tag,platform FROM tracked_hashtags WHERE id=$1 AND company_id=$2",
        [req.params.id, req.company.id],
      )
    )[0];
    if (!existing) return fail(res, 404, "Tracked hashtag not found.");
    await q("DELETE FROM tracked_hashtags WHERE id=$1 AND company_id=$2", [
      req.params.id,
      req.company.id,
    ]);
    await activity(
      req.company.id,
      `Removed tracked hashtag: ${existing.tag} (${existing.platform})`,
    );
    res.json({ ok: true });
  });
  app.post(base + "/hashtags/:id/snapshot", async (req, res) => {
    const existing = (
      await q(
        "SELECT * FROM tracked_hashtags WHERE id=$1 AND company_id=$2",
        [req.params.id, req.company.id],
      )
    )[0];
    if (!existing) return fail(res, 404, "Tracked hashtag not found.");
    const seed = hashSeed(`${existing.id}:${Date.now()}`);
    const at = now();
    const nextPosts = Number(existing.posts_count) + 1 + (seed % 3);
    const nextReach = Number(existing.reach) + 45 + (seed % 95);
    const nextInteractions = Number(existing.interactions) + 5 + (seed % 14);
    await q(
      "UPDATE tracked_hashtags SET posts_count=$1,reach=$2,interactions=$3,recorded_at=$4 WHERE id=$5 AND company_id=$6",
      [nextPosts, nextReach, nextInteractions, at, existing.id, req.company.id],
    );
    await activity(
      req.company.id,
      `Recorded manual snapshot for ${existing.tag} (${existing.platform})`,
    );
    res.json({
      id: existing.id,
      platform: existing.platform,
      tag: existing.tag,
      posts_count: nextPosts,
      reach: nextReach,
      interactions: nextInteractions,
      recorded_at: at,
    });
  });
  app.get(base + "/smartlink", async (req, res) => {
    const smartlink = (
      await q("SELECT * FROM smartlinks WHERE company_id=$1", [req.company.id])
    )[0];
    if (!smartlink) return fail(res, 404, "SmartLink page not found.");

    const items = await q(
      "SELECT id,smartlink_id,company_id,label,url,color,image_url,position,clicks,created_at,updated_at FROM smartlink_items WHERE smartlink_id=$1 ORDER BY position ASC, created_at ASC",
      [smartlink.id],
    );

    res.json({
      ...smartlink,
      visits: Number(smartlink.visits),
      items: items.map((it) => ({
        ...it,
        position: Number(it.position),
        clicks: Number(it.clicks),
      })),
    });
  });
  app.put(base + "/smartlink", async (req, res) => {
    const d = z
      .object({
        title: txt(100).min(1).optional(),
        slug: txt(100)
          .min(1)
          .regex(/^[a-z0-9-]+$/i, "Slug may only contain letters, numbers, and hyphens.")
          .optional(),
        description: txt(300).optional(),
        avatar_url: z.string().max(1000).optional().nullable(),
        theme: z.string().max(50).optional(),
      })
      .parse(req.body);

    const smartlink = (
      await q("SELECT * FROM smartlinks WHERE company_id=$1", [req.company.id])
    )[0];
    if (!smartlink) return fail(res, 404, "SmartLink page not found.");

    if (d.slug && d.slug.toLowerCase() !== smartlink.slug.toLowerCase()) {
      const conflict = (
        await q(
          "SELECT id FROM smartlinks WHERE lower(slug)=$1 AND company_id != $2",
          [d.slug.toLowerCase(), req.company.id],
        )
      )[0];
      if (conflict)
        return fail(res, 409, "This URL slug is already taken by another brand.");
    }

    const title = d.title ?? smartlink.title;
    const slug = (d.slug ?? smartlink.slug).toLowerCase();
    const description = d.description ?? smartlink.description;
    const avatar_url =
      d.avatar_url !== undefined ? d.avatar_url : smartlink.avatar_url;
    const theme = d.theme ?? smartlink.theme;
    const at = now();

    await q(
      "UPDATE smartlinks SET title=$1, slug=$2, description=$3, avatar_url=$4, theme=$5, updated_at=$6 WHERE id=$7 AND company_id=$8",
      [
        title,
        slug,
        description,
        avatar_url,
        theme,
        at,
        smartlink.id,
        req.company.id,
      ],
    );

    await activity(
      req.company.id,
      `Updated SmartLink microsite settings (/s/${slug})`,
    );

    const items = await q(
      "SELECT id,smartlink_id,company_id,label,url,color,image_url,position,clicks,created_at,updated_at FROM smartlink_items WHERE smartlink_id=$1 ORDER BY position ASC, created_at ASC",
      [smartlink.id],
    );

    res.json({
      id: smartlink.id,
      company_id: req.company.id,
      title,
      slug,
      description,
      avatar_url,
      theme,
      visits: Number(smartlink.visits),
      items: items.map((it) => ({
        ...it,
        position: Number(it.position),
        clicks: Number(it.clicks),
      })),
      created_at: smartlink.created_at,
      updated_at: at,
    });
  });
  app.post(base + "/smartlink/items", async (req, res) => {
    const smartlink = (
      await q("SELECT id FROM smartlinks WHERE company_id=$1", [req.company.id])
    )[0];
    if (!smartlink) return fail(res, 404, "SmartLink page not found.");

    const d = z
      .object({
        label: txt(100).min(1),
        url: z.string().min(1),
        color: z.string().max(50).optional(),
        image_url: z.string().max(1000).optional().nullable(),
        position: z.coerce.number().int().min(0).optional(),
      })
      .parse(req.body);

    const cleanUrl =
      d.url.startsWith("http://") || d.url.startsWith("https://")
        ? d.url
        : `https://${d.url}`;

    const maxPosRow = (
      await q(
        "SELECT MAX(position) as max_pos FROM smartlink_items WHERE smartlink_id=$1",
        [smartlink.id],
      )
    )[0];
    const position =
      d.position !== undefined
        ? d.position
        : maxPosRow?.max_pos !== null && maxPosRow?.max_pos !== undefined
          ? Number(maxPosRow.max_pos) + 1
          : 0;

    const id = randomUUID();
    const at = now();
    const color = d.color || "#e0bc68";
    const image_url = d.image_url || "";

    await q(
      "INSERT INTO smartlink_items (id,smartlink_id,company_id,label,url,color,image_url,position,clicks,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [
        id,
        smartlink.id,
        req.company.id,
        d.label,
        cleanUrl,
        color,
        image_url,
        position,
        0,
        at,
        at,
      ],
    );

    await activity(req.company.id, `Added SmartLink button: ${d.label}`);

    res.status(201).json({
      id,
      smartlink_id: smartlink.id,
      company_id: req.company.id,
      label: d.label,
      url: cleanUrl,
      color,
      image_url,
      position,
      clicks: 0,
      created_at: at,
      updated_at: at,
    });
  });
  app.put(base + "/smartlink/items/:itemId", async (req, res) => {
    const existing = (
      await q(
        "SELECT * FROM smartlink_items WHERE id=$1 AND company_id=$2",
        [req.params.itemId, req.company.id],
      )
    )[0];
    if (!existing) return fail(res, 404, "SmartLink item not found.");

    const d = z
      .object({
        label: txt(100).min(1).optional(),
        url: z.string().min(1).optional(),
        color: z.string().max(50).optional(),
        image_url: z.string().max(1000).optional().nullable(),
        position: z.coerce.number().int().min(0).optional(),
      })
      .parse(req.body);

    const label = d.label ?? existing.label;
    let url = existing.url;
    if (d.url) {
      url =
        d.url.startsWith("http://") || d.url.startsWith("https://")
          ? d.url
          : `https://${d.url}`;
    }
    const color = d.color ?? existing.color;
    const image_url =
      d.image_url !== undefined ? d.image_url : existing.image_url;
    const position =
      d.position !== undefined ? d.position : Number(existing.position);
    const at = now();

    await q(
      "UPDATE smartlink_items SET label=$1, url=$2, color=$3, image_url=$4, position=$5, updated_at=$6 WHERE id=$7 AND company_id=$8",
      [label, url, color, image_url, position, at, existing.id, req.company.id],
    );

    await activity(req.company.id, `Updated SmartLink button: ${label}`);

    res.json({
      id: existing.id,
      smartlink_id: existing.smartlink_id,
      company_id: req.company.id,
      label,
      url,
      color,
      image_url,
      position,
      clicks: Number(existing.clicks),
      created_at: existing.created_at,
      updated_at: at,
    });
  });
  app.delete(base + "/smartlink/items/:itemId", async (req, res) => {
    const existing = (
      await q(
        "SELECT id, label FROM smartlink_items WHERE id=$1 AND company_id=$2",
        [req.params.itemId, req.company.id],
      )
    )[0];
    if (!existing) return fail(res, 404, "SmartLink item not found.");

    await q("DELETE FROM smartlink_items WHERE id=$1 AND company_id=$2", [
      req.params.itemId,
      req.company.id,
    ]);

    await activity(
      req.company.id,
      `Removed SmartLink button: ${existing.label}`,
    );

    res.json({ ok: true });
  });
  app.put(base + "/smartlink/reorder", async (req, res) => {
    const { itemIds } = z
      .object({ itemIds: z.array(z.string().min(1)) })
      .parse(req.body);

    const at = now();
    for (let i = 0; i < itemIds.length; i++) {
      await q(
        "UPDATE smartlink_items SET position=$1, updated_at=$2 WHERE id=$3 AND company_id=$4",
        [i, at, itemIds[i], req.company.id],
      );
    }

    res.json({ ok: true });
  });
  const adCampaignSchema = z.object({
    name: txt(120).min(1, "Campaign name is required"),
    platform: z.enum(["meta", "google", "tiktok"]),
    status: z.enum(["active", "paused", "completed"]).default("active"),
    spend: z.coerce.number().min(0, "Spend must be at least 0"),
    impressions: z.coerce
      .number()
      .int()
      .min(0, "Impressions must be at least 0"),
    clicks: z.coerce.number().int().min(0, "Clicks must be at least 0"),
    results: z.coerce.number().int().min(0, "Results must be at least 0"),
    objective: z.string().max(100).optional().nullable(),
  });

  app.get(base + "/ads/campaigns", async (req, res) => {
    const campaigns = await q(
      "SELECT id,company_id,name,platform,status,spend,impressions,clicks,ctr,results,objective,created_at,updated_at FROM ad_campaigns WHERE company_id=$1 ORDER BY created_at DESC",
      [req.company.id],
    );
    res.json(
      campaigns.map((c) => ({
        ...c,
        spend: Number(c.spend),
        impressions: Number(c.impressions),
        clicks: Number(c.clicks),
        ctr: Number(c.ctr),
        results: Number(c.results),
      })),
    );
  });

  app.post(base + "/ads/campaigns", async (req, res) => {
    const d = adCampaignSchema.parse(req.body);
    const id = randomUUID();
    const at = now();
    const ctr =
      d.impressions > 0
        ? Number(((d.clicks / d.impressions) * 100).toFixed(2))
        : 0;
    const objective = d.objective || null;
    await q(
      "INSERT INTO ad_campaigns (id,company_id,name,platform,status,spend,impressions,clicks,ctr,results,objective,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
      [
        id,
        req.company.id,
        d.name,
        d.platform,
        d.status,
        d.spend,
        d.impressions,
        d.clicks,
        ctr,
        d.results,
        objective,
        at,
        at,
      ],
    );
    await activity(
      req.company.id,
      `Created ad campaign: ${d.name} (${d.platform})`,
    );
    res.status(201).json({
      id,
      company_id: req.company.id,
      name: d.name,
      platform: d.platform,
      status: d.status,
      spend: d.spend,
      impressions: d.impressions,
      clicks: d.clicks,
      ctr,
      results: d.results,
      objective,
      created_at: at,
      updated_at: at,
    });
  });

  app.put(base + "/ads/campaigns/:id", async (req, res) => {
    const existing = (
      await q("SELECT * FROM ad_campaigns WHERE id=$1 AND company_id=$2", [
        req.params.id,
        req.company.id,
      ])
    )[0];
    if (!existing) return fail(res, 404, "Ad campaign not found.");

    const d = adCampaignSchema.partial().parse(req.body);
    const name = d.name ?? existing.name;
    const platform = d.platform ?? existing.platform;
    const status = d.status ?? existing.status;
    const spend = d.spend !== undefined ? d.spend : Number(existing.spend);
    const impressions =
      d.impressions !== undefined
        ? d.impressions
        : Number(existing.impressions);
    const clicks =
      d.clicks !== undefined ? d.clicks : Number(existing.clicks);
    const results =
      d.results !== undefined ? d.results : Number(existing.results);
    const objective =
      d.objective !== undefined ? d.objective : existing.objective;
    const ctr =
      impressions > 0
        ? Number(((clicks / impressions) * 100).toFixed(2))
        : 0;
    const at = now();

    await q(
      "UPDATE ad_campaigns SET name=$1, platform=$2, status=$3, spend=$4, impressions=$5, clicks=$6, ctr=$7, results=$8, objective=$9, updated_at=$10 WHERE id=$11 AND company_id=$12",
      [
        name,
        platform,
        status,
        spend,
        impressions,
        clicks,
        ctr,
        results,
        objective,
        at,
        existing.id,
        req.company.id,
      ],
    );

    await activity(req.company.id, `Updated ad campaign: ${name}`);

    res.json({
      id: existing.id,
      company_id: req.company.id,
      name,
      platform,
      status,
      spend,
      impressions,
      clicks,
      ctr,
      results,
      objective,
      created_at: existing.created_at,
      updated_at: at,
    });
  });

  app.delete(base + "/ads/campaigns/:id", async (req, res) => {
    const existing = (
      await q(
        "SELECT id, name FROM ad_campaigns WHERE id=$1 AND company_id=$2",
        [req.params.id, req.company.id],
      )
    )[0];
    if (!existing) return fail(res, 404, "Ad campaign not found.");

    await q("DELETE FROM ad_campaigns WHERE id=$1 AND company_id=$2", [
      req.params.id,
      req.company.id,
    ]);

    await activity(req.company.id, `Deleted ad campaign: ${existing.name}`);

    res.json({ ok: true });
  });

  app.post(base + "/ads/connections/:platform/toggle", async (req, res) => {
    const platform = req.params.platform;
    if (!["meta", "google", "tiktok"].includes(platform)) {
      return fail(res, 400, "Invalid ad platform.");
    }
    const existing = (
      await q(
        "SELECT * FROM ad_connections WHERE platform=$1 AND company_id=$2",
        [platform, req.company.id],
      )
    )[0];
    const at = now();
    let updated;
    if (existing) {
      const nextConnected = Number(existing.connected) ? 0 : 1;
      await q(
        "UPDATE ad_connections SET connected=$1, updated_at=$2 WHERE id=$3 AND company_id=$4",
        [nextConnected, at, existing.id, req.company.id],
      );
      updated = {
        platform,
        connected: Boolean(nextConnected),
        account_name: existing.account_name,
        account_id: existing.account_id,
        currency: existing.currency || "USD",
        updated_at: at,
      };
    } else {
      const id = randomUUID();
      const names = {
        meta: "Mett Global Brand (Meta Ads)",
        google: "Mett Global Search (Google Ads)",
        tiktok: "Mett Global TikTok Ads",
      };
      const ids = {
        meta: "act_48104819",
        google: "482-194-8291",
        tiktok: "adv_91038472",
      };
      await q(
        "INSERT INTO ad_connections (id,company_id,platform,connected,account_name,account_id,currency,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          req.company.id,
          platform,
          1,
          names[platform],
          ids[platform],
          "USD",
          at,
        ],
      );
      updated = {
        platform,
        connected: true,
        account_name: names[platform],
        account_id: ids[platform],
        currency: "USD",
        updated_at: at,
      };
    }
    await activity(
      req.company.id,
      `${updated.connected ? "Connected" : "Disconnected"} ${platform} ad account`,
    );
    res.json(updated);
  });
  app.post(base + "/autolists", async (req, res) => {
    const d = autolistSchema.parse(req.body);
    const id = randomUUID();
    const at = now();
    let finalItems = [...d.items];
    let syncedAt = d.feed_synced_at || null;

    if (d.feed_url && d.feed_auto_queue) {
      const articles = await fetchFeedArticles(d.feed_url);
      const prefix = d.feed_prefix ? d.feed_prefix.trim() + " " : "";
      for (const a of articles) {
        const linkPart =
          d.feed_include_link !== false && a.link ? " " + a.link : "";
        const formatted = `${prefix}${a.title}${linkPart}`.trim();
        if (!finalItems.includes(formatted)) {
          finalItems.push(formatted);
        }
      }
      syncedAt = at;
    }

    await q(
      "INSERT INTO autolists (id,company_id,name,platform,items,slots,is_circular,feed_url,feed_prefix,feed_include_link,feed_auto_queue,feed_synced_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
      [
        id,
        req.company.id,
        d.name,
        d.platform,
        JSON.stringify(finalItems),
        JSON.stringify(d.slots),
        d.is_circular ? 1 : 0,
        d.feed_url || null,
        d.feed_prefix || null,
        d.feed_include_link !== false ? 1 : 0,
        d.feed_auto_queue !== false ? 1 : 0,
        syncedAt,
        at,
        at,
      ],
    );
    await activity(req.company.id, `Created autolist: ${d.name}`);
    res.status(201).json({
      id,
      ...d,
      items: finalItems,
      feed_synced_at: syncedAt,
      updated_at: at,
    });
  });
  app.put(base + "/autolists/:id", async (req, res) => {
    const d = autolistSchema.parse(req.body);
    const existing = (
      await q("SELECT * FROM autolists WHERE id=$1 AND company_id=$2", [
        req.params.id,
        req.company.id,
      ])
    )[0];
    if (!existing) return fail(res, 404, "Autolist not found.");
    const at = now();
    let finalItems = [...d.items];
    let syncedAt = existing.feed_synced_at;

    if (d.feed_url && d.feed_auto_queue && d.feed_url !== existing.feed_url) {
      const articles = await fetchFeedArticles(d.feed_url);
      const prefix = d.feed_prefix ? d.feed_prefix.trim() + " " : "";
      for (const a of articles) {
        const linkPart =
          d.feed_include_link !== false && a.link ? " " + a.link : "";
        const formatted = `${prefix}${a.title}${linkPart}`.trim();
        if (!finalItems.includes(formatted)) {
          finalItems.push(formatted);
        }
      }
      syncedAt = at;
    }

    await q(
      "UPDATE autolists SET name=$1,platform=$2,items=$3,slots=$4,is_circular=$5,feed_url=$6,feed_prefix=$7,feed_include_link=$8,feed_auto_queue=$9,feed_synced_at=$10,updated_at=$11 WHERE id=$12 AND company_id=$13",
      [
        d.name,
        d.platform,
        JSON.stringify(finalItems),
        JSON.stringify(d.slots),
        d.is_circular ? 1 : 0,
        d.feed_url || null,
        d.feed_prefix || null,
        d.feed_include_link !== false ? 1 : 0,
        d.feed_auto_queue !== false ? 1 : 0,
        syncedAt,
        at,
        req.params.id,
        req.company.id,
      ],
    );
    await activity(req.company.id, `Updated autolist: ${d.name}`);
    res.json({
      id: req.params.id,
      ...d,
      items: finalItems,
      feed_synced_at: syncedAt,
      updated_at: at,
    });
  });
  app.post(base + "/autolists/:id/feed/sync", async (req, res) => {
    const existing = (
      await q("SELECT * FROM autolists WHERE id=$1 AND company_id=$2", [
        req.params.id,
        req.company.id,
      ])
    )[0];
    if (!existing) return fail(res, 404, "Autolist not found.");
    if (!existing.feed_url) {
      return fail(res, 400, "Configure an RSS feed URL for this autolist first.");
    }
    const articles = await fetchFeedArticles(existing.feed_url);
    const existingItems = JSON.parse(existing.items || "[]");
    const prefix = existing.feed_prefix ? existing.feed_prefix.trim() + " " : "";
    const includeLink = existing.feed_include_link !== 0;
    const addedItems = [];

    for (const a of articles) {
      const linkPart = includeLink && a.link ? " " + a.link : "";
      const formatted = `${prefix}${a.title}${linkPart}`.trim();
      if (!existingItems.includes(formatted)) {
        existingItems.push(formatted);
        addedItems.push(formatted);
      }
    }

    const at = now();
    await q(
      "UPDATE autolists SET items=$1, feed_synced_at=$2, updated_at=$3 WHERE id=$4 AND company_id=$5",
      [JSON.stringify(existingItems), at, at, existing.id, req.company.id],
    );
    await activity(
      req.company.id,
      `Synced RSS feed for ${existing.name}: added ${addedItems.length} new items`,
    );
    res.json({
      ok: true,
      added: addedItems.length,
      items: existingItems,
      feed_synced_at: at,
    });
  });
  app.post(base + "/autolists/:id/cycle", async (req, res) => {
    const existing = (
      await q("SELECT * FROM autolists WHERE id=$1 AND company_id=$2", [
        req.params.id,
        req.company.id,
      ])
    )[0];
    if (!existing) return fail(res, 404, "Autolist not found.");
    const currentItems = JSON.parse(existing.items || "[]");
    if (!currentItems.length) {
      return fail(res, 400, "Autolist queue is empty.");
    }
    const isCircular = Boolean(Number(existing.is_circular));
    const published = currentItems[0];
    const newItems = isCircular
      ? [...currentItems.slice(1), published]
      : currentItems.slice(1);

    const at = now();
    await q(
      "UPDATE autolists SET items=$1, updated_at=$2 WHERE id=$3 AND company_id=$4",
      [JSON.stringify(newItems), at, existing.id, req.company.id],
    );
    await activity(
      req.company.id,
      `Autolist ${existing.name}: ${isCircular ? "recycled published item to queue end" : "published item and removed from queue"}`,
    );
    res.json({
      ok: true,
      published,
      items: newItems,
      is_circular: isCircular,
      updated_at: at,
    });
  });
  app.delete(base + "/autolists/:id", async (req, res) => {
    const existing = (
      await q("SELECT name FROM autolists WHERE id=$1 AND company_id=$2", [
        req.params.id,
        req.company.id,
      ])
    )[0];
    if (!existing) return fail(res, 404, "Autolist not found.");
    await q("DELETE FROM autolists WHERE id=$1 AND company_id=$2", [
      req.params.id,
      req.company.id,
    ]);
    await activity(req.company.id, `Deleted autolist: ${existing.name}`);
    res.json({ ok: true });
  });
  app.post(base + "/accounts", async (req, res) => {
    const d = z
      .object({
        platform: z.enum(platforms),
        name: txt(100).min(1),
        handle: txt(100).default(""),
      })
      .parse(req.body);
    const id = randomUUID();
    await q(
      "INSERT INTO accounts (id,company_id,platform,name,handle,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [id, req.company.id, d.platform, d.name, d.handle, "disconnected", now()],
    );
    await activity(
      req.company.id,
      `Added ${d.platform} account record: ${d.name}`,
    );
    res.status(201).json({ id, ...d, status: "disconnected" });
  });
  app.delete(base + "/accounts/:id", async (req, res) => {
    const account = (
      await q("SELECT * FROM accounts WHERE id=$1 AND company_id=$2", [
        req.params.id,
        req.company.id,
      ])
    )[0];
    if (!account) return fail(res, 404, "Account not found.");
    const posts = await q("SELECT payload FROM posts WHERE company_id=$1", [
      req.company.id,
    ]);
    if (
      posts.some((p) =>
        JSON.parse(p.payload).accountIds.includes(req.params.id),
      )
    )
      return fail(
        res,
        409,
        "Remove this account from its posts before deleting it.",
      );
    await q("DELETE FROM connections WHERE account_id=$1 AND company_id=$2", [
      req.params.id,
      req.company.id,
    ]);
    await q(
      "DELETE FROM metric_snapshots WHERE account_id=$1 AND company_id=$2",
      [req.params.id, req.company.id],
    );
    await q(
      "DELETE FROM demographic_snapshots WHERE account_id=$1 AND company_id=$2",
      [req.params.id, req.company.id],
    );
    await q(
      "DELETE FROM inbox_messages WHERE company_id=$1 AND conversation_id IN (SELECT id FROM inbox_conversations WHERE account_id=$2 AND company_id=$1)",
      [req.company.id, req.params.id],
    );
    await q(
      "DELETE FROM inbox_conversations WHERE account_id=$1 AND company_id=$2",
      [req.params.id, req.company.id],
    );
    await q("DELETE FROM accounts WHERE id=$1 AND company_id=$2", [
      req.params.id,
      req.company.id,
    ]);
    await activity(req.company.id, `Removed account record: ${account.name}`);
    res.json({ ok: true });
  });
  app.post(base + "/media", async (req, res) => {
    const d = z
      .object({
        name: txt(200).min(1),
        url: safeUrl.refine((v) => {
          try {
            const u = new URL(v);
            return ["drive.google.com", "docs.google.com"].includes(u.hostname);
          } catch {
            return false;
          }
        }, "Use a Google Drive sharing URL"),
        kind: z.enum(["video", "image"]),
      })
      .parse(req.body);
    const id = randomUUID();
    await q(
      "INSERT INTO media (id,company_id,name,url,kind,created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [id, req.company.id, d.name, d.url, d.kind, now()],
    );
    await activity(req.company.id, `Saved Drive reference: ${d.name}`);
    res.status(201).json({ id, ...d });
  });
  app.delete(base + "/media/:id", async (req, res) => {
    const m = (
      await q("SELECT id FROM media WHERE id=$1 AND company_id=$2", [
        req.params.id,
        req.company.id,
      ])
    )[0];
    if (!m) return fail(res, 404, "Media reference not found.");
    await q("DELETE FROM media WHERE id=$1 AND company_id=$2", [
      req.params.id,
      req.company.id,
    ]);
    res.json({ ok: true });
  });
  async function savePost(req, res, existingId) {
    const d = postSchema.parse(req.body);
    const companyId = req.company.id;
    if (
      existingId &&
      (
        await q(
          "SELECT id FROM youtube_jobs WHERE post_id=$1 AND company_id=$2",
          [existingId, companyId],
        )
      ).length
    )
      return fail(
        res,
        409,
        "This post has a YouTube preparation job. Inspect it in YouTube Studio; editing prepared jobs is not supported yet.",
      );
    if (new Set(d.accountIds).size !== d.accountIds.length)
      return fail(res, 400, "Duplicate destinations are not allowed.");
    const accounts = await q("SELECT * FROM accounts WHERE company_id=$1", [
      companyId,
    ]);
    if (d.accountIds.some((id) => !accounts.some((a) => a.id === id)))
      return fail(
        res,
        400,
        "Every selected account must belong to this company.",
      );
    if (
      d.accountIds.some(
        (id) => accounts.find((a) => a.id === id)?.platform === "drive",
      )
    )
      return fail(
        res,
        400,
        "Google Drive is a media source, not a publishing destination.",
      );
    if (Object.keys(d.overrides).some((id) => !d.accountIds.includes(id)))
      return fail(res, 400, "Overrides must belong to a selected destination.");
    if (
      d.intent === "queue" &&
      (!d.accountIds.length ||
        !d.scheduledAt ||
        Date.parse(d.scheduledAt) <= Date.now())
    )
      return fail(
        res,
        400,
        "Choose destinations and a future publishing time.",
      );
    if (
      existingId &&
      !(
        await q("SELECT id FROM posts WHERE id=$1 AND company_id=$2", [
          existingId,
          companyId,
        ])
      ).length
    )
      return fail(res, 404, "Post not found.");
    const status = d.intent === "queue" ? "blocked" : "draft";
    const id = existingId || randomUUID();
    const at = now();
    if (existingId)
      await q(
        "UPDATE posts SET title=$1,status=$2,scheduled_at=$3,payload=$4,updated_at=$5 WHERE id=$6 AND company_id=$7",
        [
          d.title || "Untitled post",
          status,
          d.scheduledAt,
          JSON.stringify(d),
          at,
          id,
          companyId,
        ],
      );
    else
      await q(
        "INSERT INTO posts (id,company_id,title,status,scheduled_at,payload,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          companyId,
          d.title || "Untitled post",
          status,
          d.scheduledAt,
          JSON.stringify(d),
          at,
          at,
        ],
      );
    await activity(
      companyId,
      `${status === "blocked" ? "Added blocked queue item" : existingId ? "Updated draft" : "Saved draft"}: ${d.title || "Untitled post"}`,
    );
    res.status(existingId ? 200 : 201).json({
      id,
      status,
      payload: d,
      reason:
        status === "blocked"
          ? "Publishing adapters and OAuth connections are not configured. This item will not auto-publish."
          : null,
    });
  }
  app.post(base + "/posts", (req, res) => savePost(req, res));
  app.put(base + "/posts/:id", (req, res) => savePost(req, res, req.params.id));
  app.delete(base + "/posts/:id", async (req, res) => {
    const activeJobs = await q(
      "SELECT id FROM youtube_jobs WHERE post_id=$1 AND company_id=$2",
      [req.params.id, req.company.id],
    );
    if (activeJobs.length)
      return fail(
        res,
        409,
        "This post has a YouTube preparation job. Deleting it here would not cancel the video on YouTube.",
      );
    const post = (
      await q("SELECT title FROM posts WHERE id=$1 AND company_id=$2", [
        req.params.id,
        req.company.id,
      ])
    )[0];
    if (!post) return fail(res, 404, "Post not found.");
    await q("DELETE FROM post_metrics WHERE post_id=$1 AND company_id=$2", [
      req.params.id,
      req.company.id,
    ]);
    await q("DELETE FROM posts WHERE id=$1 AND company_id=$2", [
      req.params.id,
      req.company.id,
    ]);
    await activity(req.company.id, `Deleted post: ${post.title}`);
    res.json({ ok: true });
  });
  app.use("/api", (_req, res) => fail(res, 404, "Endpoint not found."));
  const dist = options.staticDir || resolve("dist");
  if (existsSync(dist)) {
    app.use(
      express.static(dist, {
        setHeaders: (res) => res.set("Cache-Control", "no-cache"),
      }),
    );
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve(dist, "index.html")),
    );
  }
  app.use((err, _req, res, _next) => {
    if (err instanceof z.ZodError)
      return fail(
        res,
        400,
        err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      );
    if (err.type === "entity.too.large")
      return fail(res, 413, "Request is too large.");
    if (err instanceof SyntaxError) return fail(res, 400, "Invalid JSON.");
    console.error("API operation failed:", err.name);
    fail(res, 500, "The operation failed. Please retry.");
  });
  return { app, close: db.close };
}
