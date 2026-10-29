import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";

/**
 * Gives each test file its own empty database. Call before importing app code.
 *   TEST_DB=sqlite   (default) a temporary SQLite file
 *   TEST_DB=postgres an in-process Postgres (PGlite) on a local port, with the
 *                    real Supabase migration applied, reached through the same
 *                    `postgres` driver the app uses in production
 */
export async function useTestDatabase(): Promise<"sqlite" | "postgres"> {
  delete process.env.GROQ_API_KEY;
  delete process.env.DATABASE_URL;
  if (process.env.TEST_DB !== "postgres") {
    process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "saathi-test-")), "test.db");
    return "sqlite";
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
  const pg = await PGlite.create();
  const port = 20000 + Math.floor(Math.random() * 20000);
  const server = new PGLiteSocketServer({ db: pg, host: "127.0.0.1", port, maxConnections: 4 });
  await server.start();
  const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;

  const { migrate } = await import("../../scripts/db-migrate");
  await migrate(url);
  process.env.DATABASE_URL = url;
  process.env.DATABASE_POOL_MAX = "1";

  after(async () => {
    const { resetSql } = await import("../../src/lib/sql");
    await resetSql();
    await server.stop();
    await pg.close();
  });
  return "postgres";
}
