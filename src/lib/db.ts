import { seedSchemes } from "./schemes/seed";
import { fromBool, fromJson, fromNum, fromText, getSql, type Row, type Sql } from "./sql";
import type { Channel, Lang, Scheme, User } from "./types";

/**
 * Storage layer. All persistence goes through these async functions, which run
 * the same SQL on Postgres (Supabase, when DATABASE_URL is set) or SQLite.
 */

let ready: Promise<Sql> | undefined;

/** Connection plus a one-time seed of the catalogue when the schemes table is empty. */
function db(): Promise<Sql> {
  ready ??= (async () => {
    const sql = await getSql();
    const [row] = await sql.all("SELECT CAST(COUNT(*) AS INTEGER) AS n FROM schemes");
    if (fromNum(row?.n) === 0) await seedCatalogue(sql);
    return sql;
  })().catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}

/** For tests: forget the connection so the next call reconnects. */
export function resetDb() {
  ready = undefined;
}

/** Loads the built-in catalogue, keeping admin edits and what the pipeline found. */
export async function seedCatalogue(conn?: Sql): Promise<number> {
  const sql = conn ?? (await db());
  const seeds = seedSchemes();
  for (const s of seeds) {
    const existing = await getSchemeWith(sql, s.id);
    if (existing?.editedAt) continue; // an admin edited it: their version wins
    await upsertSchemeWith(sql, {
      ...s,
      openDate: existing?.openDate ?? s.openDate,
      closeDate: existing?.closeDate ?? s.closeDate,
      pendingWindow: existing?.pendingWindow,
      rejectedWindows: existing?.rejectedWindows,
      hidden: existing?.hidden,
    });
  }
  return seeds.length;
}

// ── Users ──────────────────────────────────────────────────────

function rowToUser(r: Row): User {
  return {
    id: String(r.id),
    channel: r.channel as Channel,
    externalId: String(r.external_id),
    lang: r.lang as Lang,
    step: r.step as User["step"],
    profile: fromJson(r.profile, {}),
    subscribed: fromBool(r.subscribed),
    lastResults: fromJson(r.last_results, []),
    lastInboundAt: fromText(r.last_inbound_at),
    consentAt: fromText(r.consent_at),
    createdAt: String(r.created_at),
  };
}

export async function getOrCreateUser(channel: Channel, externalId: string): Promise<User> {
  const sql = await db();
  const id = `${channel}:${externalId}`;
  const [row] = await sql.all("SELECT * FROM users WHERE id = ?", [id]);
  if (row) return rowToUser(row);
  const user: User = {
    id,
    channel,
    externalId,
    lang: "en",
    step: "language",
    profile: {},
    subscribed: true,
    lastResults: [],
    createdAt: new Date().toISOString(),
  };
  await saveUser(user);
  return user;
}

export async function saveUser(u: User): Promise<void> {
  const sql = await db();
  await sql.run(
    `INSERT INTO users (id, channel, external_id, lang, step, profile, subscribed, last_results, last_inbound_at, consent_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::boolean, ?::jsonb, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET lang = excluded.lang, step = excluded.step, profile = excluded.profile,
       subscribed = excluded.subscribed, last_results = excluded.last_results,
       last_inbound_at = excluded.last_inbound_at, consent_at = excluded.consent_at`,
    [
      u.id,
      u.channel,
      u.externalId,
      u.lang,
      u.step,
      JSON.stringify(u.profile),
      u.subscribed,
      JSON.stringify(u.lastResults),
      u.lastInboundAt,
      u.consentAt,
      u.createdAt,
    ],
  );
}

/** Erases a user completely: profile, settings and alert history (the /delete command). */
export async function deleteUser(id: string): Promise<void> {
  const sql = await db();
  await sql.run("DELETE FROM notifications WHERE user_id = ?", [id]);
  await sql.run("DELETE FROM users WHERE id = ?", [id]);
}

export async function listUsers(): Promise<User[]> {
  const sql = await db();
  return (await sql.all("SELECT * FROM users ORDER BY created_at DESC")).map(rowToUser);
}

// ── Schemes ────────────────────────────────────────────────────

async function upsertSchemeWith(sql: Sql, s: Scheme): Promise<void> {
  await sql.run(
    `INSERT INTO schemes (id, data, source, open_date, close_date, updated_at) VALUES (?, ?::jsonb, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET data = excluded.data, source = excluded.source,
       open_date = excluded.open_date, close_date = excluded.close_date, updated_at = excluded.updated_at`,
    [s.id, JSON.stringify(s), s.source, s.openDate, s.closeDate, s.updatedAt],
  );
}

async function getSchemeWith(sql: Sql, id: string): Promise<Scheme | undefined> {
  const [row] = await sql.all("SELECT data FROM schemes WHERE id = ?", [id]);
  return row ? fromJson<Scheme | undefined>(row.data, undefined) : undefined;
}

export async function upsertScheme(s: Scheme): Promise<void> {
  await upsertSchemeWith(await db(), s);
}

export async function getScheme(id: string): Promise<Scheme | undefined> {
  return getSchemeWith(await db(), id);
}

export async function listSchemes(): Promise<Scheme[]> {
  const sql = await db();
  return (await sql.all("SELECT data FROM schemes ORDER BY updated_at DESC")).map((r) => fromJson<Scheme>(r.data, {} as Scheme));
}

export async function countSchemes(): Promise<number> {
  const sql = await db();
  const [row] = await sql.all("SELECT CAST(COUNT(*) AS INTEGER) AS n FROM schemes");
  return fromNum(row?.n);
}

// ── Notifications (alert de-duplication) ───────────────────────

/** Records a notification; returns false if this one was already sent (used as a claim). */
export async function markNotified(userId: string, schemeId: string, kind: string): Promise<boolean> {
  const sql = await db();
  const changed = await sql.run(
    "INSERT INTO notifications (user_id, scheme_id, kind, sent_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
    [userId, schemeId, kind, new Date().toISOString()],
  );
  return changed > 0;
}

export async function unmarkNotified(userId: string, schemeId: string, kind: string): Promise<void> {
  const sql = await db();
  await sql.run("DELETE FROM notifications WHERE user_id = ? AND scheme_id = ? AND kind = ?", [userId, schemeId, kind]);
}

export async function wasNotified(userId: string, schemeId: string, kind: string): Promise<boolean> {
  const sql = await db();
  const rows = await sql.all("SELECT 1 AS x FROM notifications WHERE user_id = ? AND scheme_id = ? AND kind = ?", [
    userId,
    schemeId,
    kind,
  ]);
  return rows.length > 0;
}

export async function countNotifications(): Promise<number> {
  const sql = await db();
  const [row] = await sql.all("SELECT CAST(COUNT(*) AS INTEGER) AS n FROM notifications");
  return fromNum(row?.n);
}

// ── Anonymous counters ─────────────────────────────────────────

/** Anonymous event totals (no user ids), e.g. how many people declined consent. */
export async function incrementCounter(name: string): Promise<void> {
  const sql = await db();
  await sql.run(
    "INSERT INTO counters (name, value) VALUES (?, 1) ON CONFLICT (name) DO UPDATE SET value = counters.value + 1",
    [name],
  );
}

export async function getCounters(): Promise<Record<string, number>> {
  const sql = await db();
  return Object.fromEntries((await sql.all("SELECT name, value FROM counters")).map((r) => [String(r.name), fromNum(r.value)]));
}

// ── Broadcasts ─────────────────────────────────────────────────

export interface Broadcast {
  id: number;
  createdAt: string;
  finishedAt?: string;
  message: { en: string; hi?: string; ml?: string };
  audience: { channel: string; lang: string };
  status: "sending" | "done" | "error";
  total: number;
  sent: number;
  skipped: number;
}

function rowToBroadcast(r: Row): Broadcast {
  return {
    id: fromNum(r.id),
    createdAt: String(r.created_at),
    finishedAt: fromText(r.finished_at),
    message: fromJson(r.message, { en: "" }),
    audience: fromJson(r.audience, { channel: "all", lang: "all" }),
    status: r.status as Broadcast["status"],
    total: fromNum(r.total),
    sent: fromNum(r.sent),
    skipped: fromNum(r.skipped),
  };
}

export async function createBroadcast(
  message: Broadcast["message"],
  audience: Broadcast["audience"],
  total: number,
): Promise<number> {
  const sql = await db();
  const [row] = await sql.all(
    "INSERT INTO broadcasts (created_at, message, audience, status, total) VALUES (?, ?::jsonb, ?::jsonb, 'sending', ?) RETURNING id",
    [new Date().toISOString(), JSON.stringify(message), JSON.stringify(audience), total],
  );
  return fromNum(row?.id);
}

export async function updateBroadcast(
  id: number,
  fields: { sent: number; skipped: number; status?: Broadcast["status"] },
): Promise<void> {
  const sql = await db();
  const finished = fields.status && fields.status !== "sending" ? new Date().toISOString() : null;
  await sql.run(
    "UPDATE broadcasts SET sent = ?, skipped = ?, status = COALESCE(?, status), finished_at = COALESCE(?, finished_at) WHERE id = ?",
    [fields.sent, fields.skipped, fields.status ?? null, finished, id],
  );
}

export async function listBroadcasts(limit = 20): Promise<Broadcast[]> {
  const sql = await db();
  return (await sql.all("SELECT * FROM broadcasts ORDER BY id DESC LIMIT ?", [limit])).map(rowToBroadcast);
}

// ── Pipeline sources ───────────────────────────────────────────

export async function getSourceHash(url: string): Promise<string | undefined> {
  const sql = await db();
  const [row] = await sql.all("SELECT hash FROM source_state WHERE url = ?", [url]);
  return fromText(row?.hash);
}

export async function setSourceHash(url: string, hash: string): Promise<void> {
  const sql = await db();
  await sql.run(
    `INSERT INTO source_state (url, hash, checked_at) VALUES (?, ?, ?)
     ON CONFLICT (url) DO UPDATE SET hash = excluded.hash, checked_at = excluded.checked_at`,
    [url, hash, new Date().toISOString()],
  );
}

// ── Pipeline runs and the run lock ─────────────────────────────

/** A run still marked "running" after this long is treated as crashed. */
const STALE_RUN_MS = 30 * 60_000;

/**
 * Starts a pipeline run unless one is already running. A unique index allows
 * only one row with status 'running', so even two serverless instances racing
 * can't both start. Returns the new run id, or null when another run is going.
 */
export async function tryStartPipelineRun(): Promise<number | null> {
  const sql = await db();
  const now = new Date();
  await sql.run(
    "UPDATE pipeline_runs SET status = 'error', finished_at = ?, log = log || ? WHERE status = 'running' AND started_at < ?",
    [now.toISOString(), "\nAbandoned: the run did not finish.", new Date(now.getTime() - STALE_RUN_MS).toISOString()],
  );
  const rows = await sql.all(
    "INSERT INTO pipeline_runs (started_at, status) VALUES (?, 'running') ON CONFLICT DO NOTHING RETURNING id",
    [now.toISOString()],
  );
  return rows.length ? fromNum(rows[0].id) : null;
}

/** Saves the log so far, so the admin page shows progress while a run is going. */
export async function updatePipelineLog(id: number, log: string): Promise<void> {
  const sql = await db();
  await sql.run("UPDATE pipeline_runs SET log = ? WHERE id = ?", [log, id]);
}

export async function finishPipelineRun(id: number, status: "ok" | "error", log: string): Promise<void> {
  const sql = await db();
  await sql.run("UPDATE pipeline_runs SET finished_at = ?, status = ?, log = ? WHERE id = ?", [
    new Date().toISOString(),
    status,
    log,
    id,
  ]);
}

export interface PipelineRun {
  id: number;
  startedAt: string;
  finishedAt?: string;
  status: string;
  log: string;
}

function rowToRun(r: Row): PipelineRun {
  return {
    id: fromNum(r.id),
    startedAt: String(r.started_at),
    finishedAt: fromText(r.finished_at),
    status: String(r.status),
    log: String(r.log ?? ""),
  };
}

export async function listPipelineRuns(limit = 10): Promise<PipelineRun[]> {
  const sql = await db();
  return (await sql.all("SELECT * FROM pipeline_runs ORDER BY id DESC LIMIT ?", [limit])).map(rowToRun);
}

export async function getPipelineRun(id: number): Promise<PipelineRun | undefined> {
  const sql = await db();
  const [row] = await sql.all("SELECT * FROM pipeline_runs WHERE id = ?", [id]);
  return row ? rowToRun(row) : undefined;
}

export async function getRunningPipelineRun(): Promise<PipelineRun | undefined> {
  const sql = await db();
  const [row] = await sql.all("SELECT * FROM pipeline_runs WHERE status = 'running' ORDER BY id DESC LIMIT 1");
  return row ? rowToRun(row) : undefined;
}

// ── Shared rate limits and webhook de-duplication ──────────────
// Kept in the database so they hold across serverless instances.

/** Fixed-window counter. Returns whether this hit is allowed and seconds until the window resets. */
export async function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfter: number }> {
  const sql = await db();
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const [row] = await sql.all(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count`,
    [key, String(windowStart)],
  );
  return { ok: fromNum(row?.count) <= limit, retryAfter: Math.ceil((windowStart + windowMs - now) / 1000) };
}

/** Records a webhook message id. Returns false if it was already handled (a platform retry). */
export async function claimMessage(id: string): Promise<boolean> {
  const sql = await db();
  const rows = await sql.all("INSERT INTO processed_messages (id, at) VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING id", [
    id,
    new Date().toISOString(),
  ]);
  // Occasionally prune old entries (retries arrive within minutes).
  if (Math.random() < 0.02) {
    await sql.run("DELETE FROM processed_messages WHERE at < ?", [new Date(Date.now() - 3 * 86_400_000).toISOString()]);
    await sql.run("DELETE FROM rate_limits WHERE CAST(window_start AS BIGINT) < ?", [Date.now() - 86_400_000]);
  }
  return rows.length > 0;
}
