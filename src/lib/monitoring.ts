import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { env } from "./env";

/**
 * Error tracking without an SDK dependency: events go to Sentry's standard
 * envelope endpoint, so any Sentry-compatible service works (Sentry, GlitchTip,
 * self-hosted). Set SENTRY_DSN to turn it on. Server errors only; browser
 * errors and performance tracing would need the full @sentry/nextjs SDK.
 *
 * Errors also trigger a Telegram message to ADMIN_TELEGRAM_CHAT_ID, at most
 * once per ERROR_ALERT_MINUTES so an outage can't flood the admin.
 */

interface Dsn {
  url: string;
  key: string;
  raw: string;
}

let parsed: Dsn | null | undefined;

function dsn(): Dsn | null {
  if (parsed !== undefined) return parsed;
  const raw = env().monitoring.sentryDsn;
  parsed = null;
  if (raw) {
    try {
      const u = new URL(raw);
      const project = u.pathname.replace(/^\//, "");
      parsed = { url: `${u.protocol}//${u.host}/api/${project}/envelope/`, key: u.username, raw };
    } catch {
      console.error("[monitoring] SENTRY_DSN is not a valid URL; error tracking is off");
    }
  }
  return parsed;
}

function frames(stack?: string) {
  // "at fn (file:line:col)" → Sentry frames, oldest first.
  return (stack ?? "")
    .split("\n")
    .slice(1)
    .map((l) => l.trim().match(/^at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/))
    .filter(Boolean)
    .map((m) => ({ function: m![1] ?? "?", filename: m![2], lineno: Number(m![3]), colno: Number(m![4]) }))
    .reverse();
}

/** Sends one error to the tracker. Never throws. */
export async function captureError(err: unknown, context: Record<string, unknown> = {}): Promise<void> {
  const d = dsn();
  if (!d) return;
  const e = err instanceof Error ? err : new Error(String(err));
  const eventId = randomUUID().replace(/-/g, "");
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    environment: env().appEnv,
    server_name: hostname(),
    release: process.env.APP_RELEASE,
    exception: { values: [{ type: e.name, value: e.message, stacktrace: { frames: frames(e.stack) } }] },
    extra: context,
  };
  const body = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn: d.raw }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
  try {
    await fetch(d.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${d.key}, sentry_client=scheme-saathi/0.1`,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Monitoring must never break the app.
  }
}

let lastAlertAt = 0;
let suppressed = 0;
let alerting = false;

/** Telegram alert to the admin about an error, throttled. Never throws. */
export async function alertAdminOfError(message: string): Promise<void> {
  const { monitoring } = env();
  if (!monitoring.errorAlerts || alerting) return;
  const now = Date.now();
  if (now - lastAlertAt < monitoring.errorAlertMinutes * 60_000) {
    suppressed++;
    return;
  }
  alerting = true; // sending can itself log an error; don't recurse
  try {
    const { alertAdmin } = await import("./channels");
    const extra = suppressed ? `\n(+${suppressed} more errors since the last alert)` : "";
    await alertAdmin(`🚨 Scheme Saathi error (${env().appEnv})\n${message.slice(0, 500)}${extra}`);
    lastAlertAt = now;
    suppressed = 0;
  } catch {
    // ignore
  } finally {
    alerting = false;
  }
}

/** Called by log.error: tracker + throttled admin alert, in the background. */
export function reportError(msg: string, data?: Record<string, unknown>): void {
  const err = data?.err ?? new Error(msg);
  const context = { message: msg, ...Object.fromEntries(Object.entries(data ?? {}).filter(([k]) => k !== "err")) };
  void captureError(err, context);
  const detail = err instanceof Error ? `${msg}: ${err.message}` : msg;
  void alertAdminOfError(detail);
}

/** For tests. */
export function resetMonitoring() {
  parsed = undefined;
  lastAlertAt = 0;
  suppressed = 0;
}
