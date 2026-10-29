// Reload the built-in scheme catalogue (src/lib/schemes/seed.ts) into the database.
// Works with SQLite and with Postgres / Supabase (DATABASE_URL). Admin edits are kept.
import { seedCatalogue } from "../src/lib/db";
import { resetSql } from "../src/lib/sql";

console.log(`Seeded ${await seedCatalogue()} schemes.`);
await resetSql();
