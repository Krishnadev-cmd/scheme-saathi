import { configReport } from "./lib/env";

/**
 * Validates configuration so a misconfigured production deployment fails
 * immediately instead of on the first webhook.
 */
export function checkConfigOnStartup() {
  const { appEnv, errors, warnings } = configReport();
  console.log(`[scheme-saathi] starting in ${appEnv} mode`);
  for (const w of warnings) console.warn(`[config] warning: ${w}`);
  if (!errors.length) return;
  for (const e of errors) console.error(`[config] error: ${e}`);
  if (appEnv === "production") {
    if (process.env.VERCEL) {
      // On Vercel the build check (scripts/vercel-build.ts) already blocks bad deployments;
      // exiting here would only crash every cold start. Requests fail with a clear ConfigError instead.
      console.error("[config] invalid production configuration: requests will fail until it is fixed.");
      return;
    }
    console.error("[config] refusing to start: fix the settings above (see .env.production.example).");
    process.exit(1);
  }
}
