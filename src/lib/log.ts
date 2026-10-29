import { env } from "./env";
import { reportError } from "./monitoring";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function serialise(v: unknown): unknown {
  if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
  return v;
}

/**
 * Minimal logger: one JSON object per line in production (easy to ship to any
 * log service), readable console output in development.
 */
function write(level: Level, msg: string, data?: Record<string, unknown>) {
  let cfg;
  try {
    cfg = env();
  } catch {
    cfg = { isProd: true, logLevel: "info" as Level };
  }
  if (ORDER[level] < ORDER[cfg.logLevel]) return;
  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (cfg.isProd) {
    const fields = data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, serialise(v)])) : {};
    out(JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields }));
  } else {
    out(`[${level}] ${msg}`, ...(data ? [data] : []));
  }
  // Errors also go to the error tracker and (throttled) to the admin on Telegram.
  if (level === "error") reportError(msg, data);
}

export const log = {
  debug: (msg: string, data?: Record<string, unknown>) => write("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => write("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => write("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => write("error", msg, data),
};
