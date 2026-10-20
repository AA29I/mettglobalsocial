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

export async function createApp() {
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
  app.get(base + "/workspace", async (req, res) => {
    const id = req.company.id;
    const [accounts, media, posts, activities] = await Promise.all([
      q("SELECT * FROM accounts WHERE company_id=$1 ORDER BY created_at", [id]),
      q("SELECT * FROM media WHERE company_id=$1 ORDER BY created_at DESC", [
        id,
      ]),
      q("SELECT * FROM posts WHERE company_id=$1 ORDER BY updated_at DESC", [
        id,
      ]),
      q(
        "SELECT * FROM activity WHERE company_id=$1 ORDER BY created_at DESC LIMIT 20",
        [id],
      ),
    ]);
    res.json({
      accounts,
      media,
      posts: posts.map((p) => ({ ...p, payload: JSON.parse(p.payload) })),
      activities,
    });
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
    await q("DELETE FROM posts WHERE id=$1 AND company_id=$2", [
      req.params.id,
      req.company.id,
    ]);
    await activity(req.company.id, `Deleted post: ${post.title}`);
    res.json({ ok: true });
  });
  app.use("/api", (_req, res) => fail(res, 404, "Endpoint not found."));
  const dist = resolve("dist");
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
