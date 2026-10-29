// Creates or updates the Postgres / Supabase schema, then seeds the scheme catalogue.
//   npm run db:migrate           (uses DATABASE_URL from .env or the environment)
// Safe to run repeatedly: every statement is idempotent. On Vercel it runs as part of
// `vercel-build`, so each deployment brings the database up to date first.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

export async function migrate(url: string): Promise<string[]> {
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const sql = postgres(url, { prepare: false, max: 1, ssl: local ? false : "require", onnotice: () => {} });
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  try {
    for (const f of files) await sql.unsafe(readFileSync(join(dir, f), "utf8"));
  } finally {
    await sql.end({ timeout: 5 });
  }
  return files;
}

// Run when executed directly (not when imported by vercel-build).
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/db-migrate.ts")) {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log("DATABASE_URL is not set: nothing to migrate (the local SQLite database creates its own tables).");
    process.exit(0);
  }
  const files = await migrate(url);
  console.log(`Applied ${files.length} migration file(s): ${files.join(", ")}`);
  const { seedCatalogue } = await import("../src/lib/db");
  const { resetSql } = await import("../src/lib/sql");
  console.log(`Seeded ${await seedCatalogue()} schemes (admin edits kept).`);
  await resetSql();
}
