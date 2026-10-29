// Runs the whole test suite twice: on SQLite and on Postgres (PGlite, with the
// real Supabase migration). Pass "sqlite" or "postgres" to run just one.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const files = readdirSync("tests").filter((f) => f.endsWith(".test.ts")).map((f) => `tests/${f}`);
const only = process.argv[2];
const targets = only ? [only] : ["sqlite", "postgres"];

let failed = false;
for (const db of targets) {
  console.log(`\n━━ Tests on ${db} ━━`);
  const r = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
    stdio: "inherit",
    env: { ...process.env, TEST_DB: db },
  });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
