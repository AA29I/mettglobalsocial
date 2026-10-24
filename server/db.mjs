import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export async function database() {
  let query, close;
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("@neondatabase/serverless");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    query = async (sql, values = []) => (await pool.query(sql, values)).rows;
    close = () => pool.end();
  } else {
    if (process.env.VERCEL)
      throw new Error(
        "DATABASE_URL is required on Vercel. Local files are not durable there.",
      );
    const { DatabaseSync } = await import("node:sqlite");
    const dir = resolve(process.env.DATA_DIR || ".data");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(resolve(dir, "mett-social.sqlite"));
    db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    query = async (sql, values = []) => {
      const stmt = db.prepare(sql.replace(/\$\d+/g, "?"));
      return /^\s*(select|with)/i.test(sql) || /returning/i.test(sql)
        ? stmt.all(...values)
        : (stmt.run(...values), []);
    };
    close = () => db.close();
  }
  const schemas = [
    "CREATE TABLE IF NOT EXISTS auth_attempts (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, name TEXT NOT NULL, initials TEXT NOT NULL, accent TEXT NOT NULL, timezone TEXT NOT NULL, created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), platform TEXT NOT NULL, name TEXT NOT NULL, handle TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), name TEXT NOT NULL, url TEXT NOT NULL, kind TEXT NOT NULL, created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), title TEXT NOT NULL, status TEXT NOT NULL, scheduled_at TEXT, payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS autolists (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), name TEXT NOT NULL, platform TEXT NOT NULL, items TEXT NOT NULL, slots TEXT NOT NULL, is_circular INTEGER DEFAULT 0, feed_url TEXT, feed_prefix TEXT, feed_include_link INTEGER DEFAULT 1, feed_auto_queue INTEGER DEFAULT 1, feed_synced_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS metric_snapshots (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), account_id TEXT NOT NULL REFERENCES accounts(id), snapshot_date TEXT NOT NULL, followers INTEGER NOT NULL, following INTEGER NOT NULL, posts_count INTEGER NOT NULL, reach INTEGER NOT NULL, engagement INTEGER NOT NULL, recorded_at TEXT NOT NULL, UNIQUE(company_id, account_id, snapshot_date))",
    "CREATE TABLE IF NOT EXISTS post_metrics (post_id TEXT PRIMARY KEY REFERENCES posts(id), company_id TEXT NOT NULL REFERENCES companies(id), reach INTEGER NOT NULL, likes INTEGER NOT NULL, comments INTEGER NOT NULL, shares INTEGER NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS demographic_snapshots (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), account_id TEXT NOT NULL REFERENCES accounts(id), countries TEXT NOT NULL, cities TEXT NOT NULL, recorded_at TEXT NOT NULL, UNIQUE(company_id, account_id))",
    "CREATE TABLE IF NOT EXISTS competitors (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), platform TEXT NOT NULL, name TEXT NOT NULL, handle TEXT NOT NULL, followers INTEGER NOT NULL, posts_count INTEGER NOT NULL, engagement INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS inbox_conversations (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), account_id TEXT NOT NULL REFERENCES accounts(id), platform TEXT NOT NULL, participant_name TEXT NOT NULL, participant_handle TEXT NOT NULL, participant_initials TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, unread INTEGER NOT NULL, last_message_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS inbox_messages (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), conversation_id TEXT NOT NULL REFERENCES inbox_conversations(id), sender_name TEXT NOT NULL, sender_handle TEXT NOT NULL, direction TEXT NOT NULL, delivery_source TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS report_templates (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), name TEXT NOT NULL, period_days INTEGER NOT NULL, platforms TEXT NOT NULL, include_summary INTEGER NOT NULL, include_network_overview INTEGER NOT NULL, include_top_posts INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS tracked_hashtags (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), platform TEXT NOT NULL, tag TEXT NOT NULL, posts_count INTEGER NOT NULL, reach INTEGER NOT NULL, interactions INTEGER NOT NULL, recorded_at TEXT NOT NULL, UNIQUE(company_id, platform, tag))",
    "CREATE TABLE IF NOT EXISTS smartlinks (id TEXT PRIMARY KEY, company_id TEXT UNIQUE NOT NULL REFERENCES companies(id), slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, avatar_url TEXT, theme TEXT DEFAULT 'brand', visits INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS smartlink_items (id TEXT PRIMARY KEY, smartlink_id TEXT NOT NULL REFERENCES smartlinks(id), company_id TEXT NOT NULL REFERENCES companies(id), label TEXT NOT NULL, url TEXT NOT NULL, color TEXT, image_url TEXT, position INTEGER NOT NULL DEFAULT 0, clicks INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS ad_campaigns (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), name TEXT NOT NULL, platform TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', spend REAL NOT NULL DEFAULT 0, impressions INTEGER NOT NULL DEFAULT 0, clicks INTEGER NOT NULL DEFAULT 0, ctr REAL NOT NULL DEFAULT 0, results INTEGER NOT NULL DEFAULT 0, objective TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS ad_connections (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), platform TEXT NOT NULL, connected INTEGER NOT NULL DEFAULT 0, account_name TEXT NOT NULL, account_id TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'USD', updated_at TEXT NOT NULL, UNIQUE(company_id, platform))",
    "CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), message TEXT NOT NULL, created_at TEXT NOT NULL)",
    "CREATE INDEX IF NOT EXISTS posts_company ON posts(company_id)",
    "CREATE INDEX IF NOT EXISTS autolists_company ON autolists(company_id)",
    "CREATE INDEX IF NOT EXISTS metric_snapshots_company ON metric_snapshots(company_id, account_id, snapshot_date)",
    "CREATE INDEX IF NOT EXISTS post_metrics_company ON post_metrics(company_id)",
    "CREATE INDEX IF NOT EXISTS demographic_snapshots_company ON demographic_snapshots(company_id, account_id)",
    "CREATE INDEX IF NOT EXISTS competitors_company ON competitors(company_id, platform)",
    "CREATE INDEX IF NOT EXISTS inbox_conversations_company ON inbox_conversations(company_id, last_message_at)",
    "CREATE INDEX IF NOT EXISTS inbox_messages_conversation ON inbox_messages(company_id, conversation_id, created_at)",
    "CREATE INDEX IF NOT EXISTS report_templates_company ON report_templates(company_id)",
    "CREATE INDEX IF NOT EXISTS tracked_hashtags_company ON tracked_hashtags(company_id, platform)",
    "CREATE INDEX IF NOT EXISTS smartlinks_slug ON smartlinks(slug)",
    "CREATE INDEX IF NOT EXISTS smartlinks_company ON smartlinks(company_id)",
    "CREATE INDEX IF NOT EXISTS smartlink_items_smartlink ON smartlink_items(smartlink_id, position ASC)",
    "CREATE INDEX IF NOT EXISTS ad_campaigns_company ON ad_campaigns(company_id, platform)",
    "CREATE INDEX IF NOT EXISTS ad_connections_company ON ad_connections(company_id, platform)",
    "CREATE INDEX IF NOT EXISTS accounts_company ON accounts(company_id)",
    "CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)",
  ];
  for (const sql of schemas) await query(sql);
  const migrations = [
    "ALTER TABLE autolists ADD COLUMN is_circular INTEGER DEFAULT 0",
    "ALTER TABLE autolists ADD COLUMN feed_url TEXT",
    "ALTER TABLE autolists ADD COLUMN feed_prefix TEXT",
    "ALTER TABLE autolists ADD COLUMN feed_include_link INTEGER DEFAULT 1",
    "ALTER TABLE autolists ADD COLUMN feed_auto_queue INTEGER DEFAULT 1",
    "ALTER TABLE autolists ADD COLUMN feed_synced_at TEXT",
  ];
  for (const sql of migrations) {
    try {
      await query(sql);
    } catch {
      // Safe to ignore if column already exists
    }
  }
  return { query, close };
}
