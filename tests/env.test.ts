import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigError, configReport, env, resetEnvCache } from "../src/lib/env";

const KEYS = [
  "APP_ENV",
  "APP_BASE_URL",
  "CRON_SECRET",
  "ADMIN_TOKEN",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_APP_SECRET",
];

function withEnv(vars: Record<string, string>, fn: () => void) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  resetEnvCache();
  try {
    fn();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    resetEnvCache();
  }
}

const SECRET = "x".repeat(32);

test("development tolerates missing settings", () => {
  withEnv({ APP_ENV: "development" }, () => {
    const cfg = env();
    assert.equal(cfg.isProd, false);
    assert.ok(configReport().warnings.length > 0);
  });
});

test("production refuses to run without required secrets", () => {
  withEnv({ APP_ENV: "production", TELEGRAM_BOT_TOKEN: "123:abc" }, () => {
    assert.throws(() => env(), ConfigError);
    const { errors } = configReport();
    assert.ok(errors.some((e) => e.includes("CRON_SECRET")));
    assert.ok(errors.some((e) => e.includes("TELEGRAM_WEBHOOK_SECRET")));
  });
});

test("production rejects http base URLs and short secrets", () => {
  withEnv(
    {
      APP_ENV: "production",
      APP_BASE_URL: "http://saathi.example.in",
      CRON_SECRET: "short",
      ADMIN_TOKEN: SECRET,
      TELEGRAM_BOT_TOKEN: "123:abc",
      TELEGRAM_WEBHOOK_SECRET: SECRET,
    },
    () => {
      const { errors } = configReport();
      assert.ok(errors.some((e) => e.includes("https")));
      assert.ok(errors.some((e) => e.includes("CRON_SECRET must be at least")));
    },
  );
});

test("valid production config passes", () => {
  withEnv(
    {
      APP_ENV: "production",
      APP_BASE_URL: "https://saathi.example.in/",
      CRON_SECRET: SECRET,
      ADMIN_TOKEN: SECRET,
      WHATSAPP_TOKEN: "EAAG",
      WHATSAPP_PHONE_NUMBER_ID: "1234567890",
      WHATSAPP_VERIFY_TOKEN: SECRET,
      WHATSAPP_APP_SECRET: SECRET,
    },
    () => {
      const cfg = env();
      assert.equal(cfg.isProd, true);
      assert.equal(cfg.baseUrl, "https://saathi.example.in");
      assert.equal(cfg.whatsapp.enabled, true);
      assert.equal(cfg.telegram.enabled, false);
      assert.deepEqual(configReport().errors, []);
    },
  );
});

test("empty values count as unset", () => {
  withEnv({ APP_ENV: "production", CRON_SECRET: "  ", ADMIN_TOKEN: "" }, () => {
    assert.ok(configReport().errors.some((e) => e.startsWith("CRON_SECRET is required")));
  });
});
