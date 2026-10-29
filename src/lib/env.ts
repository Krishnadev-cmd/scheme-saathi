import { z } from "zod";

/**
 * Single source of truth for server configuration.
 *
 * APP_ENV selects the behaviour profile:
 *   development — relaxed: admin/cron open when tokens are unset, webhook
 *                 signature checks skipped when secrets are unset, pretty logs.
 *   production  — strict: required secrets must be present (startup fails
 *                 otherwise), every webhook and admin request is authenticated,
 *                 JSON logs, HSTS.
 *
 * APP_ENV defaults to NODE_ENV (which `next dev` / `next start` set), so it only
 * needs setting explicitly to run a production build in development mode, or
 * the other way round.
 */

// `KEY=` in an env file means "unset", not "empty string".
const opt = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().optional());

const Schema = z.object({
  APP_ENV: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : undefined),
    z.enum(["development", "production"]).optional(),
  ),
  APP_BASE_URL: opt,
  DATABASE_PATH: opt,
  /** Postgres connection string (Supabase). When set, Postgres is used instead of SQLite. */
  DATABASE_URL: opt,
  DATABASE_POOL_MAX: opt,
  PIPELINE_TIME_BUDGET_SECONDS: opt,
  /** Set by Vercel. */
  VERCEL: opt,
  VERCEL_ENV: opt,
  VERCEL_URL: opt,
  VERCEL_PROJECT_PRODUCTION_URL: opt,

  GROQ_API_KEY: opt,
  GROQ_MODEL: opt,

  TELEGRAM_BOT_TOKEN: opt,
  TELEGRAM_WEBHOOK_SECRET: opt,

  WHATSAPP_TOKEN: opt,
  WHATSAPP_PHONE_NUMBER_ID: opt,
  WHATSAPP_VERIFY_TOKEN: opt,
  WHATSAPP_APP_SECRET: opt,
  WHATSAPP_API_VERSION: opt,
  WHATSAPP_NOTIFY_TEMPLATE: opt,
  WHATSAPP_TEMPLATE_LANG_EN: opt,
  WHATSAPP_TEMPLATE_LANG_HI: opt,
  WHATSAPP_TEMPLATE_LANG_ML: opt,

  CRON_SECRET: opt,
  ADMIN_TOKEN: opt,
  ADMIN_TELEGRAM_CHAT_ID: opt,

  ENABLE_WEB_DEMO: opt,
  CHAT_RATE_LIMIT_PER_MIN: opt,
  LOG_LEVEL: opt,
  SENTRY_DSN: opt,
  ERROR_ALERTS: opt,
  ERROR_ALERT_MINUTES: opt,
});

type Raw = z.infer<typeof Schema>;

export interface Config {
  appEnv: "development" | "production";
  isProd: boolean;
  baseUrl: string;
  databasePath?: string;
  database: { url?: string; driver: "postgres" | "sqlite"; poolMax: number };
  /** Running on Vercel (serverless: no persistent disk, many short-lived instances). */
  onVercel: boolean;
  /** Stop starting new sources after this long, so a run finishes within the function limit. */
  pipelineBudgetMs: number;
  groq: { apiKey?: string; model: string };
  telegram: { enabled: boolean; token?: string; webhookSecret?: string };
  whatsapp: {
    enabled: boolean;
    token?: string;
    phoneNumberId?: string;
    verifyToken?: string;
    appSecret?: string;
    apiVersion: string;
    notifyTemplate?: string;
    templateLang: { en: string; hi: string; ml: string };
  };
  cronSecret?: string;
  adminToken?: string;
  /** Telegram chat that receives pipeline reports (review queue, failures). */
  adminTelegramChatId?: string;
  webDemoEnabled: boolean;
  chatRateLimitPerMin: number;
  logLevel: "debug" | "info" | "warn" | "error";
  monitoring: {
    /** Sentry (or compatible) DSN; error tracking is off when unset. */
    sentryDsn?: string;
    /** Telegram alerts to the admin on errors (needs ADMIN_TELEGRAM_CHAT_ID). */
    errorAlerts: boolean;
    errorAlertMinutes: number;
  };
}

const MIN_SECRET = 16;

function build(raw: Raw): { config: Config; errors: string[]; warnings: string[] } {
  const appEnv = raw.APP_ENV ?? (process.env.NODE_ENV === "production" ? "production" : "development");
  const isProd = appEnv === "production";
  const errors: string[] = [];
  const warnings: string[] = [];

  const onVercel = !!raw.VERCEL;
  // On Vercel, fall back to the domain Vercel assigns when APP_BASE_URL isn't set.
  const vercelHost = raw.VERCEL_ENV === "production" ? raw.VERCEL_PROJECT_PRODUCTION_URL : raw.VERCEL_URL;
  const baseUrl = raw.APP_BASE_URL ?? (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
  const dbUrl = raw.DATABASE_URL;

  const config: Config = {
    appEnv,
    isProd,
    baseUrl: baseUrl.replace(/\/$/, ""),
    databasePath: raw.DATABASE_PATH,
    database: {
      url: dbUrl,
      driver: dbUrl ? "postgres" : "sqlite",
      // Serverless functions each hold their own pool; keep it small so Supabase's pooler isn't exhausted.
      poolMax: Math.max(1, Number(raw.DATABASE_POOL_MAX ?? (onVercel ? 1 : 5)) || 1),
    },
    onVercel,
    // Vercel functions here allow 300 s; keep headroom for alerts and saving the log.
    pipelineBudgetMs: 1000 * Math.max(30, Number(raw.PIPELINE_TIME_BUDGET_SECONDS ?? (onVercel ? 200 : 1800)) || 200),
    groq: { apiKey: raw.GROQ_API_KEY, model: raw.GROQ_MODEL ?? "openai/gpt-oss-120b" },
    telegram: {
      enabled: !!raw.TELEGRAM_BOT_TOKEN,
      token: raw.TELEGRAM_BOT_TOKEN,
      webhookSecret: raw.TELEGRAM_WEBHOOK_SECRET,
    },
    whatsapp: {
      enabled: !!(raw.WHATSAPP_TOKEN && raw.WHATSAPP_PHONE_NUMBER_ID),
      token: raw.WHATSAPP_TOKEN,
      phoneNumberId: raw.WHATSAPP_PHONE_NUMBER_ID,
      verifyToken: raw.WHATSAPP_VERIFY_TOKEN,
      appSecret: raw.WHATSAPP_APP_SECRET,
      apiVersion: raw.WHATSAPP_API_VERSION ?? "v23.0",
      notifyTemplate: raw.WHATSAPP_NOTIFY_TEMPLATE,
      templateLang: {
        en: raw.WHATSAPP_TEMPLATE_LANG_EN ?? "en",
        hi: raw.WHATSAPP_TEMPLATE_LANG_HI ?? "hi",
        ml: raw.WHATSAPP_TEMPLATE_LANG_ML ?? "ml",
      },
    },
    cronSecret: raw.CRON_SECRET,
    adminToken: raw.ADMIN_TOKEN,
    adminTelegramChatId: raw.ADMIN_TELEGRAM_CHAT_ID,
    // The browser demo calls the real agent (and Groq); it is rate limited, and
    // can be switched off with ENABLE_WEB_DEMO=false.
    webDemoEnabled: raw.ENABLE_WEB_DEMO !== "false",
    chatRateLimitPerMin: Number(raw.CHAT_RATE_LIMIT_PER_MIN ?? 20) || 20,
    monitoring: {
      sentryDsn: raw.SENTRY_DSN,
      errorAlerts: raw.ERROR_ALERTS !== "false",
      errorAlertMinutes: Math.max(1, Number(raw.ERROR_ALERT_MINUTES ?? 10) || 10),
    },
    logLevel: (["debug", "info", "warn", "error"].includes(raw.LOG_LEVEL ?? "")
      ? raw.LOG_LEVEL
      : isProd
        ? "info"
        : "debug") as Config["logLevel"],
  };

  const need = (ok: unknown, msg: string) => {
    if (!ok) (isProd ? errors : warnings).push(msg);
  };
  const strong = (v: string | undefined, name: string) => {
    if (v && v.length < MIN_SECRET) (isProd ? errors : warnings).push(`${name} must be at least ${MIN_SECRET} characters`);
  };

  need(raw.APP_BASE_URL || vercelHost, "APP_BASE_URL is required (public https URL of this deployment)");
  if (isProd && !config.baseUrl.startsWith("https://")) errors.push("APP_BASE_URL must use https in production");

  if (dbUrl && !/^postgres(ql)?:\/\//.test(dbUrl)) {
    errors.push("DATABASE_URL must be a postgres:// or postgresql:// connection string");
  }
  if (onVercel && !dbUrl) {
    // Vercel's filesystem is temporary and not shared between instances: SQLite would lose data.
    (isProd ? errors : warnings).push("DATABASE_URL is required on Vercel (use your Supabase connection string); SQLite data would be lost");
  }
  if (dbUrl && onVercel && /:5432\//.test(dbUrl) && /supabase\.(co|com)/.test(dbUrl)) {
    warnings.push("DATABASE_URL uses Supabase's direct port 5432; on Vercel use the pooler (port 6543, transaction mode) to avoid running out of connections");
  }
  need(raw.CRON_SECRET, "CRON_SECRET is required to protect /api/pipeline/run");
  need(raw.ADMIN_TOKEN, "ADMIN_TOKEN is required to protect /admin");
  strong(raw.CRON_SECRET, "CRON_SECRET");
  strong(raw.ADMIN_TOKEN, "ADMIN_TOKEN");

  if (!config.telegram.enabled && !config.whatsapp.enabled) {
    need(false, "No channel configured: set TELEGRAM_BOT_TOKEN and/or WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID");
  }
  if (config.telegram.enabled) {
    need(raw.TELEGRAM_WEBHOOK_SECRET, "TELEGRAM_WEBHOOK_SECRET is required when Telegram is enabled");
    strong(raw.TELEGRAM_WEBHOOK_SECRET, "TELEGRAM_WEBHOOK_SECRET");
  }
  if (raw.WHATSAPP_TOKEN && !raw.WHATSAPP_PHONE_NUMBER_ID) need(false, "WHATSAPP_PHONE_NUMBER_ID is required with WHATSAPP_TOKEN");
  if (config.whatsapp.enabled) {
    need(raw.WHATSAPP_VERIFY_TOKEN, "WHATSAPP_VERIFY_TOKEN is required when WhatsApp is enabled");
    need(raw.WHATSAPP_APP_SECRET, "WHATSAPP_APP_SECRET is required when WhatsApp is enabled (webhook signature check)");
    if (!raw.WHATSAPP_NOTIFY_TEMPLATE) warnings.push("WHATSAPP_NOTIFY_TEMPLATE is not set: alerts reach only users active in the last 24h");
  }
  if (isProd && !raw.SENTRY_DSN) warnings.push("SENTRY_DSN is not set: errors are only written to the log");
  if (isProd && !raw.ADMIN_TELEGRAM_CHAT_ID) warnings.push("ADMIN_TELEGRAM_CHAT_ID is not set: no Telegram alerts for errors or items to review");
  if (!raw.GROQ_API_KEY) warnings.push("GROQ_API_KEY is not set: running rule-based (no free-text understanding or AI extraction)");

  return { config, errors, warnings };
}

let cached: ReturnType<typeof build> | undefined;

function load() {
  if (!cached) {
    const parsed = Schema.safeParse(process.env);
    if (!parsed.success) {
      const msgs = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      cached = { config: build({} as Raw).config, errors: msgs, warnings: [] };
    } else {
      cached = build(parsed.data);
    }
  }
  return cached;
}

/** True while `next build` is prerendering; production secrets aren't available then. */
const isBuildPhase = () => process.env.NEXT_PHASE === "phase-production-build";

export class ConfigError extends Error {}

/** Returns the validated config. In production, throws if required settings are missing. */
export function env(): Config {
  const { config, errors } = load();
  if (errors.length && config.isProd && !isBuildPhase()) {
    throw new ConfigError(`Invalid production configuration:\n  - ${errors.join("\n  - ")}`);
  }
  return config;
}

export function configReport() {
  const { config, errors, warnings } = load();
  return { appEnv: config.appEnv, errors, warnings };
}

/** For tests: forget the cached config after changing process.env. */
export function resetEnvCache() {
  cached = undefined;
}
