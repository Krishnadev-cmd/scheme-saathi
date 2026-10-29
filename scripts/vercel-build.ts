// Runs on Vercel before `next build` (package.json "vercel-build").
//  1. Validates configuration. With APP_ENV=production, any missing or invalid
//     required setting fails the deployment here, with the list of problems,
//     instead of deploying an app that errors on every request.
//  2. Applies the Supabase migrations and seeds the scheme catalogue.
import { configReport } from "../src/lib/env";
import { migrate } from "./db-migrate";

const { appEnv, errors, warnings } = configReport();
const where = process.env.VERCEL_ENV ? `Vercel ${process.env.VERCEL_ENV}` : "local";
console.log(`\n▶ Scheme Saathi build check (${where}, APP_ENV=${appEnv})`);
for (const w of warnings) console.log(`  warning: ${w}`);

if (errors.length) {
  for (const e of errors) console.log(`  ERROR:   ${e}`);
  if (appEnv === "production") {
    console.log(
      "\n✖ Deployment stopped: fix the settings above in Vercel → Project → Settings → Environment Variables, then redeploy.\n" +
        "  (For Preview deployments, either add the same variables for the Preview environment or set APP_ENV=development there.)\n",
    );
    process.exit(1);
  }
}

const url = process.env.DATABASE_URL?.trim();
if (url) {
  const files = await migrate(url);
  console.log(`  database: applied ${files.length} migration file(s)`);
  const { seedCatalogue } = await import("../src/lib/db");
  const { resetSql } = await import("../src/lib/sql");
  console.log(`  database: ${await seedCatalogue()} schemes seeded (admin edits kept)`);
  await resetSql();
} else {
  console.log("  database: DATABASE_URL not set, skipping migrations");
}
console.log("✔ Build check passed\n");
