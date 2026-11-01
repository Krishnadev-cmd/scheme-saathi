import assert from "node:assert/strict";
import { test } from "node:test";

import { useTestDatabase } from "./helpers/testdb";

// Isolated database (SQLite, or Postgres with TEST_DB=postgres) and rule-based mode.
await useTestDatabase();

const { handleMessage, containsSensitiveData } = await import("../src/lib/agent");
const { getOrCreateUser, upsertScheme, getScheme } = await import("../src/lib/db");
const { passes, windowStatus } = await import("../src/lib/eligibility");
const { parseLooseDate, heuristicWindows } = await import("../src/lib/pipeline/run");

async function say(id: string, text: string, optionId?: string) {
  return handleMessage(await getOrCreateUser("web", id), { text, optionId });
}

test("full Malayalam conversation for a Kerala farmer", async () => {
  const id = "test-farmer-01";
  const first = await say(id, "hi");
  assert.equal(first[0].options?.length, 3); // language picker

  const consent = await say(id, "മലയാളം", "ml");
  assert.deepEqual(consent[0].options?.map((o) => o.id), ["consent:yes", "consent:no"]);
  assert.match(consent[0].text, /\/delete/);
  const intro = await say(id, "ഞാൻ സമ്മതിക്കുന്നു", "consent:yes");
  assert.match(intro[1].text, /പ്രായം/);

  await say(id, "45");
  await say(id, "1"); // male
  const area = await say(id, "കേരളം");
  assert.match(area[0].text, /ഗ്രാമ/);
  await say(id, "rural");
  const land = await say(id, "1"); // farmer -> asks land question
  assert.match(land[0].text, /കൃഷിഭൂമി/);
  await say(id, "അതെ");
  await say(id, "inc_1l", "inc_1l");
  await say(id, "OBC");
  await say(id, "ഇല്ല");
  await say(id, "yes");
  const done = await say(id, "no");

  const user = await getOrCreateUser("web", id);
  assert.equal(user.step, "done");
  assert.equal(user.lang, "ml");
  assert.equal(user.profile.state, "Kerala");
  assert.ok(user.lastResults.includes("pm-kisan"));
  assert.ok(user.lastResults.includes("kerala-kasp"));
  assert.ok(!user.lastResults.includes("ssy"));
  assert.match(done[0].text, /പദ്ധതികൾക്ക്/);

  const details = await say(id, "1");
  assert.match(details[0].text, /https:\/\//);
});

test("Hindi flow skips the land question for non-farmers", async () => {
  const id = "test-student-01";
  await say(id, "start");
  const consent = await say(id, "hi", "hi"); // Telegram callback payload
  assert.deepEqual(consent[0].options?.map((o) => o.id), ["consent:yes", "consent:no"]);
  await say(id, "मैं सहमत हूँ", "consent:yes");
  await say(id, "मेरी उम्र 22 साल है");
  await say(id, "महिला");
  await say(id, "उत्तर प्रदेश");
  await say(id, "2"); // urban
  const next = await say(id, "छात्र / छात्रा");
  assert.match(next[0].text, /आय/); // straight to income
  await say(id, "2"); // up to 2.5L
  await say(id, "SC");
  await say(id, "नहीं");
  await say(id, "हाँ");
  await say(id, "नहीं");
  const u = await getOrCreateUser("web", id);
  assert.equal(u.step, "done");
  assert.ok(u.lastResults.includes("nsp-post-matric"));
  assert.ok(u.lastResults.includes("pm-internship"));
  assert.ok(!u.lastResults.includes("pm-kisan"));
});

test("identity numbers are refused and not stored", async () => {
  assert.ok(containsSensitiveData("my aadhaar is 1234 5678 9012"));
  assert.ok(containsSensitiveData("PAN ABCDE1234F"));
  assert.ok(!containsSensitiveData("I am 34 years old"));
  const id = "test-pii-01";
  await say(id, "hi");
  await say(id, "English", "en");
  await say(id, "I agree", "consent:yes");
  const r = await say(id, "1234 5678 9012");
  assert.match(r[0].text, /don't share Aadhaar/);
  assert.equal((await getOrCreateUser("web", id)).profile.age, undefined);
});

test("eligibility rules and windows", async () => {
  const standUp = (await getScheme("stand-up-india"))!;
  assert.ok(passes(standUp.rules, { gender: "female", category: "general", occupation: "self_employed" }));
  assert.ok(passes(standUp.rules, { gender: "male", category: "sc", occupation: "self_employed" }));
  assert.ok(!passes(standUp.rules, { gender: "male", category: "general", occupation: "self_employed" }));

  const s = { ...standUp, openDate: "2026-01-01", closeDate: "2026-01-31" };
  assert.equal(windowStatus(s, new Date("2025-12-01")), "upcoming");
  assert.equal(windowStatus(s, new Date("2026-01-15")), "open");
  assert.equal(windowStatus(s, new Date("2026-02-01")), "closed");
});

test("pipeline heuristics find deadlines next to known scheme names", async () => {
  assert.equal(parseLooseDate("last date 31-10-2026"), "2026-10-31");
  assert.equal(parseLooseDate("apply by 5 Nov 2026"), "2026-11-05");
  assert.equal(parseLooseDate("deadline November 30, 2026"), "2026-11-30");
  const scheme = (await getScheme("nsp-post-matric"))!;
  await upsertScheme(scheme);
  const found = heuristicWindows(
    "Notice: Post-Matric Scholarships (SC/ST/OBC/Minority) portal is open. Last date for applying: 30/11/2026.",
    [scheme],
  );
  assert.deepEqual(found, [{ id: "nsp-post-matric", closeDate: "2026-11-30" }]);
});

test("no questions are asked or stored without consent", async () => {
  const id = "test-consent-no";
  await say(id, "hi");
  await say(id, "English", "en");
  const r = await say(id, "No, thanks", "consent:no");
  assert.match(r[0].text, /not saved your details/);
  // The row was deleted, so the next message starts from the language picker.
  const again = await say(id, "34");
  assert.equal(again[0].options?.length, 3);
});

test("an existing user without consent is asked once, then resumes", async () => {
  const id = "test-legacy-user";
  const u = await getOrCreateUser("web", id);
  Object.assign(u, { lang: "en", step: "gender", profile: { age: 30 } });
  const { saveUser } = await import("../src/lib/db");
  await saveUser(u);
  const r = await say(id, "Female");
  assert.match(r[0].text, /Do you agree/);
  const resumed = await say(id, "I agree", "consent:yes");
  assert.match(resumed[0].text, /gender/i);
  assert.ok((await getOrCreateUser("web", id)).consentAt);
});

test("/delete erases the profile after confirmation", async () => {
  const id = "test-delete-01";
  await say(id, "hi");
  await say(id, "English", "en");
  await say(id, "I agree", "consent:yes");
  await say(id, "45");
  const confirm = await say(id, "/delete");
  assert.deepEqual(confirm[0].options?.map((o) => o.id), ["delete:yes", "delete:no"]);
  const cancelled = await say(id, "Cancel", "delete:no");
  assert.match(cancelled[0].text, /Nothing was deleted/);
  assert.equal((await getOrCreateUser("web", id)).profile.age, 45);

  await say(id, "/delete");
  const done = await say(id, "Yes, delete", "delete:yes");
  assert.match(done[0].text, /has been deleted/);
  const fresh = await getOrCreateUser("web", id);
  assert.equal(fresh.profile.age, undefined);
  assert.equal(fresh.consentAt, undefined);
  assert.equal(fresh.step, "language");
});
