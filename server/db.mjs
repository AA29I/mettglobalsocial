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
    "CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), message TEXT NOT NULL, created_at TEXT NOT NULL)",
    "CREATE INDEX IF NOT EXISTS posts_company ON posts(company_id)",
    "CREATE INDEX IF NOT EXISTS accounts_company ON accounts(company_id)",
    "CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)",
  ];
  for (const sql of schemas) await query(sql);
  return { query, close };
}
