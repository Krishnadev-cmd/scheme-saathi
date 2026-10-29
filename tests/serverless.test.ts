import assert from "node:assert/strict";
import { test } from "node:test";
import { useTestDatabase } from "./helpers/testdb";

const kind = await useTestDatabase();
const db = await import("../src/lib/db");
const { env, resetEnvCache, configReport } = await import("../src/lib/env");

test(`uses the expected database driver (${kind})`, () => {
  assert.equal(env().database.driver, kind);
});

test("rate limits are counted in the database, so they hold across instances", async () => {
  const key = `test:${Math.random()}`;
  const results = [];
  for (let i = 0; i < 4; i++) results.push((await db.hitRateLimit(key, 3, 60_000)).ok);
  assert.deepEqual(results, [true, true, true, false]);
  const other = await db.hitRateLimit(`${key}:other`, 3, 60_000);
  assert.equal(other.ok, true, "limits are per key");
});

test("a retried webhook message is only handled once", async () => {
  assert.equal(await db.claimMessage("telegram:1001"), true);
  assert.equal(await db.claimMessage("telegram:1001"), false);
  assert.equal(await db.claimMessage("whatsapp:wamid.1001"), true);
});

test("JSON and boolean columns round-trip", async () => {
  const u = await db.getOrCreateUser("telegram", "roundtrip");
  Object.assign(u, { profile: { age: 41, state: "Kerala", bpl: false }, subscribed: false, lastResults: ["pm-kisan"] });
  await db.saveUser(u);
  const back = await db.getOrCreateUser("telegram", "roundtrip");
  assert.deepEqual(back.profile, { age: 41, state: "Kerala", bpl: false });
  assert.equal(back.subscribed, false);
  assert.deepEqual(back.lastResults, ["pm-kisan"]);
  assert.equal((await db.listSchemes()).length, 25, "catalogue seeded on first use");
});

test("production on Vercel requires a Postgres DATABASE_URL and uses the Vercel domain", () => {
  const saved = { ...process.env };
  const secret = "s".repeat(32);
  try {
    Object.assign(process.env, {
      APP_ENV: "production",
      VERCEL: "1",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "scheme-saathi.vercel.app",
      CRON_SECRET: secret,
      ADMIN_TOKEN: secret,
      TELEGRAM_BOT_TOKEN: "123:abc",
      TELEGRAM_WEBHOOK_SECRET: secret,
    });
    delete process.env.APP_BASE_URL;
    delete process.env.DATABASE_URL;
    resetEnvCache();
    assert.deepEqual(configReport().errors, [
      "DATABASE_URL is required on Vercel (use your Supabase connection string); SQLite data would be lost",
    ]);

    process.env.DATABASE_URL = "mysql://nope";
    resetEnvCache();
    assert.ok(configReport().errors.some((e) => e.includes("postgres://")));

    process.env.DATABASE_URL = "postgresql://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";
    resetEnvCache();
    assert.deepEqual(configReport().errors, []);
    assert.equal(env().baseUrl, "https://scheme-saathi.vercel.app");
    assert.equal(env().database.driver, "postgres");
    assert.equal(env().database.poolMax, 1, "one connection per serverless instance");
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    resetEnvCache();
  }
});
