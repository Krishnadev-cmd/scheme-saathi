import assert from "node:assert/strict";
import { test } from "node:test";

import { useTestDatabase } from "./helpers/testdb";

// Isolated database (SQLite, or Postgres with TEST_DB=postgres) and rule-based mode.
await useTestDatabase();

const db = await import("../src/lib/db");
const { matchSchemes } = await import("../src/lib/eligibility");
const review = await import("../src/lib/review");
const { beginPipelineRun, runPipeline, PipelineBusyError } = await import("../src/lib/pipeline/run");
import type { Scheme } from "../src/lib/types";

const farmer = { age: 40, occupation: "farmer" as const, state: "Kerala", ownsLand: true };

function newScheme(id: string): Scheme {
  return {
    id,
    name: { en: `Test Farmer Grant ${id}` },
    ministry: "Test Ministry",
    level: "central",
    summary: { en: "Test" },
    benefits: { en: "₹1,000" },
    documents: [],
    howToApply: { en: "Online" },
    applyUrl: "https://example.gov.in",
    rules: { occupations: ["farmer"] },
    source: "pipeline",
    sourceUrl: "https://example.gov.in/notice",
    updatedAt: new Date().toISOString(),
  };
}

const visibleIds = async () => matchSchemes(await db.listSchemes(), farmer).map((s) => s.id);

test("a discovered scheme stays hidden until approved", async () => {
  await review.proposeNewScheme(newScheme("grant-a"));
  assert.ok(!(await visibleIds()).includes("grant-a"), "pending scheme must not reach users");
  assert.equal((await review.listReviewQueue()).newSchemes.length, 1);

  const outcome = await review.approve("grant-a");
  assert.equal(outcome?.kind, "new");
  assert.ok((await visibleIds()).includes("grant-a"));
  assert.equal((await review.listReviewQueue()).newSchemes.length, 0);
});

test("a rejected scheme stays hidden and out of the queue", async () => {
  await review.proposeNewScheme(newScheme("grant-b"));
  await review.reject("grant-b");
  assert.equal((await db.getScheme("grant-b"))?.review, "rejected");
  assert.ok(!(await visibleIds()).includes("grant-b"));
  assert.equal(await review.countPendingReview(), 0);
});

test("a window change is applied only after approval", async () => {
  const kisan = (await db.getScheme("pm-kisan"))!;
  assert.equal(await review.proposeWindow(kisan, { closeDate: "2099-12-31" }, "https://pmkisan.gov.in"), true);
  assert.equal((await db.getScheme("pm-kisan"))!.closeDate, undefined, "live window unchanged while pending");
  assert.equal((await review.listReviewQueue()).windowChanges.length, 1);

  // The same proposal isn't queued twice.
  assert.equal(await review.proposeWindow((await db.getScheme("pm-kisan"))!, { closeDate: "2099-12-31" }, "x"), false);

  await review.approve("pm-kisan");
  const after = (await db.getScheme("pm-kisan"))!;
  assert.equal(after.closeDate, "2099-12-31");
  assert.equal(after.pendingWindow, undefined);
});

test("a rejected window is never proposed again", async () => {
  const ssy = (await db.getScheme("ssy"))!;
  await review.proposeWindow(ssy, { closeDate: "2099-01-15" }, "https://example.gov.in");
  await review.reject("ssy");
  assert.equal((await db.getScheme("ssy"))!.closeDate, undefined);
  assert.equal(await review.proposeWindow((await db.getScheme("ssy"))!, { closeDate: "2099-01-15" }, "x"), false);
});

test("reloading the seed catalogue keeps pending review state", async () => {
  const apy = (await db.getScheme("apy"))!;
  await review.proposeWindow(apy, { closeDate: "2099-03-01" }, "https://example.gov.in");
  await db.seedCatalogue();
  assert.equal((await db.getScheme("apy"))!.pendingWindow?.closeDate, "2099-03-01");
});

test("only one pipeline run can hold the lock", async () => {
  const first = await beginPipelineRun();
  assert.ok(first != null);
  assert.equal(await beginPipelineRun(), null, "second start must be refused while the first runs");
  await assert.rejects(() => runPipeline({ notify: false }), PipelineBusyError);
  await db.finishPipelineRun(first!, "ok", "");
  assert.ok((await beginPipelineRun()) != null, "lock is free once the run finishes");
});

test("describeRules gives reviewers a readable summary", () => {
  const lines = review.describeRules({ minAge: 18, maxAge: 40, occupations: ["farmer"], maxIncome: 250000 });
  assert.deepEqual(lines, ["Age 18–40", "For: farmers", "Family income up to ₹2,50,000"]);
});
