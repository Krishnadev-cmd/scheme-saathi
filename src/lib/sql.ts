import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { env } from "./env";

/**
 * Minimal async SQL driver with two backends:
 *  - Postgres (Supabase) when DATABASE_URL is set — required on Vercel;
 *  - Node's built-in SQLite otherwise (local development, Docker).
 *
 * Queries are written once: `?` placeholders, and casts like `?::jsonb`
 * that Postgres needs and SQLite ignores (they are stripped for SQLite).
 */

export type Row = Record<string, unknown>;
export type Param = string | number | boolean | null | undefined;

export interface Sql {
  dialect: "postgres" | "sqlite";
  all(query: string, params?: Param[]): Promise<Row[]>;
  /** Returns the number of affected rows. */
  run(query: string, params?: Param[]): Promise<number>;
  close(): Promise<void>;
}

let instance: Promise<Sql> | undefined;

export function getSql(): Promise<Sql> {
  instance ??= create().catch((err) => {
    instance = undefined; // retry on the next call (e.g. a transient connection error)
    throw err;
  });
  return instance;
}

/** For tests and scripts: close the connection so the next getSql() reconnects. */
export async function resetSql(): Promise<void> {
  const current = instance;
  instance = undefined;
  if (current) await (await current).close().catch(() => {});
}

async function create(): Promise<Sql> {
  const url = env().database.url;
  return url ? createPostgres(url) : createSqlite();
}

// ── Postgres (Supabase) ────────────────────────────────────────

async function createPostgres(url: string): Promise<Sql> {
  const { default: postgres } = await import("postgres");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const pg = postgres(url, {
    // Supabase's pooler (port 6543) runs in transaction mode, which doesn't support prepared statements.
    prepare: false,
    max: env().database.poolMax,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: local ? false : "require",
    onnotice: () => {},
  });
  const toPg = (q: string) => {
    let i = 0;
    return q.replace(/\?/g, () => `$${++i}`);
  };
  const sql: Sql = {
    dialect: "postgres",
    async all(q, params = []) {
      return (await pg.unsafe(toPg(q), params.map((p) => p ?? null) as never[])) as unknown as Row[];
    },
    async run(q, params = []) {
      const res = await pg.unsafe(toPg(q), params.map((p) => p ?? null) as never[]);
      return res.count ?? 0;
    },
    async close() {
      await pg.end({ timeout: 5 });
    },
  };
  const [check] = await sql.all("SELECT to_regclass('public.users') AS users, to_regclass('public.rate_limits') AS rl");
  if (!check?.users || !check?.rl) {
    throw new Error(
      "Database tables are missing. Run `npm run db:migrate` (or paste supabase/migrations/*.sql into the Supabase SQL editor) against DATABASE_URL.",
    );
  }
  return sql;
}

// ── SQLite (local) ─────────────────────────────────────────────

const SQLITE_SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, channel TEXT NOT NULL, external_id TEXT NOT NULL,
    lang TEXT NOT NULL DEFAULT 'en', step TEXT NOT NULL DEFAULT 'language',
    profile TEXT NOT NULL DEFAULT '{}', subscribed INTEGER NOT NULL DEFAULT 1,
    last_results TEXT NOT NULL DEFAULT '[]', last_inbound_at TEXT, consent_at TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS schemes (
    id TEXT PRIMARY KEY, data TEXT NOT NULL, source TEXT NOT NULL,
    open_date TEXT, close_date TEXT, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications (
    user_id TEXT NOT NULL, scheme_id TEXT NOT NULL, kind TEXT NOT NULL, sent_at TEXT NOT NULL,
    PRIMARY KEY (user_id, scheme_id, kind)
  );
  CREATE TABLE IF NOT EXISTS source_state (url TEXT PRIMARY KEY, hash TEXT NOT NULL, checked_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS broadcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, finished_at TEXT,
    message TEXT NOT NULL, audience TEXT NOT NULL, status TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS pipeline_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT NOT NULL, finished_at TEXT,
    status TEXT NOT NULL, log TEXT NOT NULL DEFAULT ''
  );
  CREATE UNIQUE INDEX IF NOT EXISTS pipeline_runs_one_running ON pipeline_runs (status) WHERE status = 'running';
  CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, window_start TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS processed_messages (id TEXT PRIMARY KEY, at TEXT NOT NULL);
`;

async function createSqlite(): Promise<Sql> {
  const { DatabaseSync } = await import("node:sqlite");
  const configured = env().databasePath;
  const file = configured
    ? resolve(/*turbopackIgnore: true*/ configured)
    : join(process.cwd(), "data", "scheme-saathi.db");
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SQLITE_SCHEMA);
  // Columns added after the first release.
  const cols = (db.prepare("PRAGMA table_info(users)").all() as Row[]).map((c) => c.name);
  if (!cols.includes("consent_at")) db.exec("ALTER TABLE users ADD COLUMN consent_at TEXT");

  const toLite = (q: string) => q.replace(/::\w+/g, "");
  const args = (params: Param[]) =>
    params.map((p) => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : p)) as (string | number | null)[];
  return {
    dialect: "sqlite",
    async all(q, params = []) {
      return db.prepare(toLite(q)).all(...args(params)) as Row[];
    },
    async run(q, params = []) {
      return Number(db.prepare(toLite(q)).run(...args(params)).changes);
    },
    async close() {
      db.close();
    },
  };
}

// ── Value helpers shared by both backends ──────────────────────

/** jsonb comes back parsed from Postgres and as text from SQLite. */
export function fromJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

export const fromBool = (v: unknown) => v === true || v === 1 || v === "1" || v === "t";
export const fromNum = (v: unknown) => Number(v ?? 0);
export const fromText = (v: unknown) => (v == null ? undefined : String(v));
