import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
  randomUUID,
} from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export const providerNames = ["google", "meta", "pinterest", "tiktok"];
const digest = (value) => createHash("sha256").update(value).digest("hex");
function encryptionKey() {
  if (process.env.TOKEN_ENCRYPTION_KEY) {
    const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "base64");
    if (key.length !== 32)
      throw new Error("TOKEN_ENCRYPTION_KEY must encode 32 bytes");
    return key;
  }
  if (process.env.VERCEL || process.env.DATABASE_URL)
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be configured for hosted connections",
    );
  const dir = resolve(process.env.DATA_DIR || ".data");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = resolve(dir, "token.key");
  if (!existsSync(path))
    writeFileSync(path, randomBytes(32), { mode: 0o600, flag: "wx" });
  return readFileSync(path);
}
export function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), body]
    .map((b) => b.toString("base64"))
    .join(".");
}
export function decrypt(value) {
  const [iv, tag, body] = value.split(".").map((v) => Buffer.from(v, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([cipher.update(body), cipher.final()]).toString(),
  );
}
function config(provider) {
  const origin = process.env.APP_ORIGIN || "http://127.0.0.1:5173";
  const keys = {
    google: "GOOGLE",
    meta: "META",
    pinterest: "PINTEREST",
    tiktok: "TIKTOK",
  };
  const prefix = keys[provider];
  const id = process.env[prefix + "_CLIENT_ID"];
  const secret = process.env[prefix + "_CLIENT_SECRET"];
  return {
    id,
    secret,
    redirect: origin + "/api/oauth/callback/" + provider,
    missing: [
      (process.env.VERCEL || process.env.NODE_ENV === "production") &&
        !process.env.APP_ORIGIN &&
        "APP_ORIGIN",
      !id && prefix + "_CLIENT_ID",
      !secret && prefix + "_CLIENT_SECRET",
      (process.env.VERCEL || process.env.DATABASE_URL) &&
        !process.env.TOKEN_ENCRYPTION_KEY &&
        "TOKEN_ENCRYPTION_KEY",
    ].filter(Boolean),
  };
}
async function json(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json();
  if (
    !response.ok ||
    (body.error &&
      (typeof body.error === "string" ||
        (body.error.code && body.error.code !== "ok")))
  )
    throw new Error(
      "The platform rejected the authorization or data request. Check developer app permissions and reconnect.",
    );
  return body;
}
const bearer = (token) => ({ Authorization: "Bearer " + token });
export async function connections(q) {
  await q(
    "CREATE TABLE IF NOT EXISTS oauth_states (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), provider TEXT NOT NULL, verifier TEXT NOT NULL, expires_at TEXT NOT NULL)",
  );
  await q(
    "CREATE TABLE IF NOT EXISTS connections (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), account_id TEXT NOT NULL REFERENCES accounts(id), provider TEXT NOT NULL, external_id TEXT NOT NULL, credentials TEXT NOT NULL, expires_at TEXT NOT NULL, UNIQUE(company_id,provider,external_id))",
  );
  async function store(
    companyId,
    provider,
    platform,
    externalId,
    name,
    handle,
    tokens,
  ) {
    const old = (
      await q(
        "SELECT * FROM connections WHERE company_id=$1 AND provider=$2 AND external_id=$3",
        [companyId, provider, externalId],
      )
    )[0];
    const accountId = old?.account_id || randomUUID();
    const id = old?.id || randomUUID();
    const expiresAt = new Date(
      Date.now() + (Number(tokens.expires_in) || 3600) * 1000,
    ).toISOString();
    if (old && !tokens.refresh_token)
      tokens.refresh_token = decrypt(old.credentials).refresh_token;
    if (!old) {
      await q(
        "INSERT INTO accounts (id,company_id,platform,name,handle,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [
          accountId,
          companyId,
          platform,
          name,
          handle || "",
          "authorized",
          new Date().toISOString(),
        ],
      );
      await q(
        "INSERT INTO connections (id,company_id,account_id,provider,external_id,credentials,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          companyId,
          accountId,
          provider,
          externalId,
          encrypt(tokens),
          expiresAt,
        ],
      );
    } else {
      await q(
        "UPDATE connections SET credentials=$1,expires_at=$2 WHERE id=$3",
        [encrypt(tokens), expiresAt, id],
      );
      await q(
        "UPDATE accounts SET status=$1,name=$2,handle=$3 WHERE id=$4 AND company_id=$5",
        ["authorized", name, handle || "", accountId, companyId],
      );
    }
  }
  async function authorize(provider, companyId) {
    if (!providerNames.includes(provider))
      throw new Error("Unsupported provider.");
    const c = config(provider);
    if (c.missing.length)
      throw new Error(
        "Configure " +
          c.missing.join(", ") +
          " securely in deployment settings first.",
      );
    encryptionKey();
    const state = randomBytes(32).toString("hex"),
      verifier = randomBytes(48).toString("base64url");
    await q("DELETE FROM oauth_states WHERE expires_at<$1", [
      new Date().toISOString(),
    ]);
    await q(
      "INSERT INTO oauth_states (id,company_id,provider,verifier,expires_at) VALUES ($1,$2,$3,$4,$5)",
      [
        digest(state),
        companyId,
        provider,
        encrypt({ verifier }),
        new Date(Date.now() + 600000).toISOString(),
      ],
    );
    const urls = {
      google: "https://accounts.google.com/o/oauth2/v2/auth",
      meta: "https://www.facebook.com/v23.0/dialog/oauth",
      pinterest: "https://www.pinterest.com/oauth/",
      tiktok: "https://www.tiktok.com/v2/auth/authorize/",
    };
    const url = new URL(urls[provider]);
    const params = {
      response_type: "code",
      redirect_uri: c.redirect,
      state,
      ...(provider === "tiktok" ? { client_key: c.id } : { client_id: c.id }),
    };
    const scopes = {
      google:
        "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
      meta: "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish",
      pinterest: "boards:read,pins:read,pins:write,user_accounts:read",
      tiktok: "user.info.basic,video.publish,video.upload",
    };
    Object.entries({ ...params, scope: scopes[provider] }).forEach(([k, v]) =>
      url.searchParams.set(k, v),
    );
    if (provider === "google") {
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set(
        "code_challenge",
        createHash("sha256").update(verifier).digest("base64url"),
      );
      url.searchParams.set("code_challenge_method", "S256");
    }
    return url.toString();
  }
  async function callback(provider, code, state) {
    if (
      !providerNames.includes(provider) ||
      typeof state !== "string" ||
      typeof code !== "string"
    )
      throw new Error("Invalid OAuth callback.");
    // Atomic consume prevents replay, including concurrent callbacks. Never restore consumed state.
    const s = (
      await q(
        "DELETE FROM oauth_states WHERE id=$1 AND provider=$2 AND expires_at>$3 RETURNING *",
        [digest(state), provider, new Date().toISOString()],
      )
    )[0];
    if (!s)
      throw new Error(
        "The connection request expired or has already been used. Start again.",
      );
    const c = config(provider);
    const { verifier } = decrypt(s.verifier);
    let tokens;
    if (provider === "meta") {
      tokens = await json(
        "https://graph.facebook.com/v23.0/oauth/access_token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: c.id,
            client_secret: c.secret,
            redirect_uri: c.redirect,
            code,
          }),
        },
      );
      const pages = await json(
        "https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}",
        { headers: bearer(tokens.access_token) },
      );
      if (!pages.data?.length)
        throw new Error(
          "No eligible Facebook Pages were returned. Check Page access and developer permissions.",
        );
      for (const page of pages.data) {
        await store(
          s.company_id,
          provider,
          "facebook",
          page.id,
          page.name,
          "",
          { ...tokens, access_token: page.access_token },
        );
        const ig = page.instagram_business_account;
        if (ig)
          await store(
            s.company_id,
            provider,
            "instagram",
            ig.id,
            ig.name || ig.username,
            "@" + ig.username,
            { ...tokens, access_token: page.access_token },
          );
      }
    } else {
      const tokenUrls = {
        google: "https://oauth2.googleapis.com/token",
        pinterest: "https://api.pinterest.com/v5/oauth/token",
        tiktok: "https://open.tiktokapis.com/v2/oauth/token/",
      };
      const params = {
        grant_type: "authorization_code",
        code,
        redirect_uri: c.redirect,
        ...(provider === "tiktok"
          ? { client_key: c.id, client_secret: c.secret }
          : provider === "google"
            ? {
                client_id: c.id,
                client_secret: c.secret,
                code_verifier: verifier,
              }
            : {}),
      };
      tokens = await json(tokenUrls[provider], {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...(provider === "pinterest"
            ? {
                Authorization:
                  "Basic " +
                  Buffer.from(c.id + ":" + c.secret).toString("base64"),
              }
            : {}),
        },
        body: new URLSearchParams(params),
      });
      if (!tokens.access_token)
        throw new Error("No access token returned by the platform.");
      if (provider === "google") {
        const about = await json(
          "https://www.googleapis.com/drive/v3/about?fields=user(displayName,permissionId)",
          { headers: bearer(tokens.access_token) },
        );
        await store(
          s.company_id,
          provider,
          "drive",
          "drive:" + about.user.permissionId,
          about.user.displayName + " · Drive",
          "",
          tokens,
        );
        const channels = await json(
          "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
          { headers: bearer(tokens.access_token) },
        );
        for (const channel of channels.items || [])
          await store(
            s.company_id,
            provider,
            "youtube",
            channel.id,
            channel.snippet.title,
            channel.snippet.customUrl,
            tokens,
          );
      } else if (provider === "pinterest") {
        const user = await json("https://api.pinterest.com/v5/user_account", {
          headers: bearer(tokens.access_token),
        });
        await store(
          s.company_id,
          provider,
          "pinterest",
          user.username,
          user.business_name || user.username,
          "@" + user.username,
          tokens,
        );
      } else {
        const info = await json(
          "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
          { headers: bearer(tokens.access_token) },
        );
        if (!info.data?.user?.open_id)
          throw new Error("TikTok account details were not returned.");
        const user = info.data.user;
        await store(
          s.company_id,
          provider,
          "tiktok",
          user.open_id,
          user.display_name,
          "",
          tokens,
        );
      }
    }
    return s.company_id;
  }
  async function googleAccess(companyId, accountId) {
    const c = (
      await q(
        "SELECT * FROM connections WHERE company_id=$1 AND account_id=$2 AND provider=$3",
        [companyId, accountId, "google"],
      )
    )[0];
    if (!c) throw new Error("Authorize this Google account first.");
    let tokens = decrypt(c.credentials);
    if (Date.parse(c.expires_at) < Date.now() + 60000) {
      if (!tokens.refresh_token)
        throw new Error(
          "Google authorization expired. Reconnect this account.",
        );
      const cfg = config("google");
      const refreshed = await json("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: tokens.refresh_token,
          client_id: cfg.id,
          client_secret: cfg.secret,
        }),
      });
      tokens = { ...tokens, ...refreshed };
      await q(
        "UPDATE connections SET credentials=$1,expires_at=$2 WHERE id=$3",
        [
          encrypt(tokens),
          new Date(
            Date.now() + (Number(refreshed.expires_in) || 3600) * 1000,
          ).toISOString(),
          c.id,
        ],
      );
    }
    return { token: tokens.access_token, externalId: c.external_id };
  }
  async function driveFiles(companyId, accountId, pageToken = "") {
    const { token } = await googleAccess(companyId, accountId);
    const u = new URL("https://www.googleapis.com/drive/v3/files");
    u.search = new URLSearchParams({
      q: "trashed=false and (mimeType contains 'video/' or mimeType contains 'image/')",
      fields: "nextPageToken,files(id,name,mimeType,size,webViewLink)",
      pageSize: "50",
      orderBy: "modifiedTime desc",
      ...(pageToken ? { pageToken } : {}),
    }).toString();
    return json(u.toString(), { headers: bearer(token) });
  }
  return {
    authorize,
    callback,
    driveFiles,
    googleAccess,
    readiness: () =>
      Object.fromEntries(
        providerNames.map((p) => [
          p,
          {
            configured: !config(p).missing.length,
            missing: config(p).missing,
            callbackUrl: config(p).redirect,
          },
        ]),
      ),
  };
}
