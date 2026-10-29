import { createHash } from "node:crypto";
import { isAdmin } from "@/lib/admin-auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { listSchemes, listUsers } from "@/lib/db";
import { isLive, windowStatus } from "@/lib/eligibility";
import {
  AREA_OPTIONS,
  CATEGORY_OPTIONS,
  GENDER_OPTIONS,
  INCOME_OPTIONS,
  OCCUPATION_OPTIONS,
  STR,
  YES_NO,
} from "@/lib/i18n";
import { log } from "@/lib/log";
import { describeRules } from "@/lib/review";
import type { Localized } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chat ids are personal data: exports carry a one-way pseudonym instead.
const pseudonym = (id: string) => createHash("sha256").update(id).digest("hex").slice(0, 12);
const day = () => new Date().toISOString().slice(0, 10);

async function users() {
  const rows = (await listUsers()).map((u) => [
    pseudonym(u.id),
    u.channel,
    u.lang,
    u.step,
    u.subscribed,
    u.consentAt,
    u.createdAt,
    u.lastInboundAt,
    u.profile.age,
    u.profile.gender,
    u.profile.state,
    u.profile.area,
    u.profile.occupation,
    u.profile.annualIncome,
    u.profile.category,
    u.profile.disability,
    u.profile.bpl,
    u.profile.ownsLand,
    u.profile.hasGirlChildUnder10,
  ]);
  return toCsv(
    ["user", "channel", "language", "step", "alerts_on", "consent_at", "created_at", "last_message_at", "age", "gender", "state", "area", "occupation", "income_upper_bound", "category", "disability", "bpl_card", "owns_land", "daughter_under_10"],
    rows,
  );
}

async function schemes() {
  return toCsv(
    ["id", "name_en", "name_hi", "name_ml", "ministry", "level", "benefits_en", "who_qualifies", "apply_url", "open_date", "close_date", "window", "status", "source", "edited_at"],
    (await listSchemes()).map((s) => [
      s.id,
      s.name.en,
      s.name.hi,
      s.name.ml,
      s.ministry,
      s.level,
      s.benefits.en,
      describeRules(s.rules).join("; "),
      s.applyUrl,
      s.openDate,
      s.closeDate,
      windowStatus(s),
      s.hidden ? "hidden" : s.review === "pending" ? "pending review" : s.review === "rejected" ? "rejected" : "live",
      s.source,
      s.editedAt,
    ]),
  );
}

/** Every Hindi and Malayalam string next to its English source, with empty columns for reviewers. */
async function translations() {
  const rows: (string | undefined)[][] = [];
  const add = (key: string, l: Localized) => rows.push([key, l.en, l.hi, "", l.ml, "", ""]);
  for (const [k, v] of Object.entries(STR)) add(`bot.${k}`, v as Localized);
  const sets = { gender: GENDER_OPTIONS, area: AREA_OPTIONS, occupation: OCCUPATION_OPTIONS, income: INCOME_OPTIONS, category: CATEGORY_OPTIONS, yesno: YES_NO };
  for (const [set, opts] of Object.entries(sets)) for (const o of opts) add(`option.${set}.${o.id}`, o.label);
  for (const s of (await listSchemes()).filter(isLive)) {
    add(`scheme.${s.id}.name`, s.name);
    add(`scheme.${s.id}.summary`, s.summary);
    add(`scheme.${s.id}.benefits`, s.benefits);
    add(`scheme.${s.id}.how_to_apply`, s.howToApply);
  }
  return toCsv(["key", "english", "hindi", "hindi_corrected", "malayalam", "malayalam_corrected", "reviewer_notes"], rows);
}

/** One row per live scheme for checking amounts and rules against the official site. */
async function factCheck() {
  return toCsv(
    ["id", "scheme", "benefits_as_shown", "who_qualifies_as_coded", "apply_url", "window", "official_source_checked", "correct_yes_no", "corrected_text", "checked_by", "checked_on"],
    (await listSchemes())
      .filter(isLive)
      .map((s) => [
        s.id,
        s.name.en,
        s.benefits.en,
        describeRules(s.rules).join("; "),
        s.applyUrl,
        s.openDate || s.closeDate ? `${s.openDate ?? "now"} to ${s.closeDate ?? "open"}` : "rolling",
        "",
        "",
        "",
        "",
        "",
      ]),
  );
}

const FILES: Record<string, () => Promise<string>> = {
  "users.csv": users,
  "schemes.csv": schemes,
  "translations.csv": translations,
  "fact-check.csv": factCheck,
};

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  if (!(await isAdmin())) return new Response("unauthorized", { status: 401 });
  const { file } = await params;
  const build = FILES[file];
  if (!build) return new Response("not found", { status: 404 });
  log.info("admin export", { file });
  return csvResponse(`scheme-saathi-${file.replace(".csv", "")}-${day()}.csv`, await build());
}
