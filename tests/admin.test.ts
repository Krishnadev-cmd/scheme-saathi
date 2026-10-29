import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { useTestDatabase } from "./helpers/testdb";

// Isolated database (SQLite, or Postgres with TEST_DB=postgres) and rule-based mode.
await useTestDatabase();

const db = await import("../src/lib/db");
const { applySchemeEdit } = await import("../src/lib/scheme-edit");
const { toCsv } = await import("../src/lib/csv");
const { funnel } = await import("../src/lib/insights");
const { audienceUsers } = await import("../src/lib/broadcast");
const { captureError, resetMonitoring } = await import("../src/lib/monitoring");
const { resetEnvCache } = await import("../src/lib/env");
const { isLive } = await import("../src/lib/eligibility");

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const base = async (id: string) => {
  const s = (await db.getScheme(id))!;
  return {
    id,
    nameEn: s.name.en,
    nameHi: s.name.hi ?? "",
    nameMl: s.name.ml ?? "",
    summaryEn: s.summary.en,
    benefitsEn: s.benefits.en,
    howEn: s.howToApply.en,
    ministry: s.ministry,
    level: s.level,
    applyUrl: s.applyUrl,
    documents: s.documents.join("\n"),
    openDate: "",
    closeDate: "",
    rules: JSON.stringify(s.rules),
  };
};

test("scheme edits are validated and survive a re-seed", async () => {
  const ok = applySchemeEdit((await db.getScheme("pm-kisan"))!, form({ ...(await base("pm-kisan")), benefitsEn: "₹6,000 a year (edited)" }));
  assert.ok(ok.ok);
  if (ok.ok) await db.upsertScheme(ok.scheme);
  await db.seedCatalogue();
  assert.equal((await db.getScheme("pm-kisan"))!.benefits.en, "₹6,000 a year (edited)");

  const badUrl = applySchemeEdit((await db.getScheme("ssy"))!, form({ ...(await base("ssy")), applyUrl: "http://insecure.example" }));
  assert.equal(badUrl.ok, false);
  const badRules = applySchemeEdit((await db.getScheme("ssy"))!, form({ ...(await base("ssy")), rules: '{"minAge": "old"}' }));
  assert.equal(badRules.ok, false);
  const badDates = applySchemeEdit((await db.getScheme("ssy"))!, form({ ...(await base("ssy")), openDate: "2026-12-01", closeDate: "2026-11-01" }));
  assert.equal(badDates.ok, false);
});

test("hidden schemes are not live", async () => {
  const s = (await db.getScheme("pmsby"))!;
  await db.upsertScheme({ ...s, hidden: true });
  assert.equal(isLive((await db.getScheme("pmsby"))!), false);
});

test("CSV escapes quotes, commas and spreadsheet formulas", () => {
  const out = toCsv(["a", "b"], [['he said "hi", ok', "=SUM(A1)"]]);
  assert.ok(out.startsWith("﻿"));
  assert.ok(out.includes('"he said ""hi"", ok"'));
  assert.ok(out.includes("'=SUM(A1)"));
});

test("funnel counts how far people got and where they stalled", async () => {
  const old = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const now = new Date().toISOString();
  const mk = async (n: string, step: string, last: string) => {
    const u = await db.getOrCreateUser("telegram", n);
    Object.assign(u, { step, lastInboundAt: last, consentAt: now });
    await db.saveUser(u);
  };
  await mk("f1", "done", now);
  await mk("f2", "income", old); // stalled at income
  await mk("f3", "income", old); // stalled at income
  await mk("f4", "age", now); // still active
  const f = await funnel();
  const row = (s: string) => f.rows.find((r) => r.step === s)!;
  assert.equal(f.total, 4);
  assert.equal(row("age").reached, 4);
  assert.equal(row("income").reached, 3);
  assert.equal(row("income").stalled, 2);
  assert.equal(row("done").reached, 1);
  assert.equal(f.worstStep, "income");
});

test("broadcasts only reach subscribed users who consented", async () => {
  const u = await db.getOrCreateUser("telegram", "no-consent");
  Object.assign(u, { step: "done", consentAt: undefined });
  await db.saveUser(u);
  const ids = (await audienceUsers({ channel: "all", lang: "all" })).map((x) => x.externalId);
  assert.ok(ids.includes("f1"));
  assert.ok(!ids.includes("no-consent"));
});

test("errors are sent to a Sentry-compatible endpoint", async () => {
  let received = "";
  let auth = "";
  const server = createServer((req, res) => {
    auth = String(req.headers["x-sentry-auth"]);
    req.on("data", (c) => (received += c));
    req.on("end", () => res.end("{}"));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  process.env.SENTRY_DSN = `http://publickey@127.0.0.1:${port}/42`;
  resetEnvCache();
  resetMonitoring();
  await captureError(new Error("boom"), { where: "test" });
  server.close();
  delete process.env.SENTRY_DSN;
  resetEnvCache();
  resetMonitoring();

  const [header, item, event] = received.split("\n").map((l) => JSON.parse(l));
  assert.ok(header.event_id);
  assert.equal(item.type, "event");
  assert.equal(event.exception.values[0].value, "boom");
  assert.equal(event.extra.where, "test");
  assert.match(auth, /sentry_key=publickey/);
});
