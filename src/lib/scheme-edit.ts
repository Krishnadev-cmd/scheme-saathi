import { z } from "zod";
import type { EligibilityRules, Scheme } from "./types";

const OCC = ["farmer", "student", "salaried", "self_employed", "street_vendor", "artisan", "labourer", "homemaker", "unemployed", "retired"] as const;

const RuleSet: z.ZodType<EligibilityRules> = z.lazy(() =>
  z
    .object({
      minAge: z.number().int().min(0).max(120).optional(),
      maxAge: z.number().int().min(0).max(120).optional(),
      genders: z.array(z.enum(["male", "female", "transgender"])).optional(),
      occupations: z.array(z.enum(OCC)).optional(),
      categories: z.array(z.enum(["general", "obc", "sc", "st", "ews", "minority"])).optional(),
      maxIncome: z.number().int().positive().optional(),
      states: z.array(z.string().min(2)).optional(),
      area: z.enum(["rural", "urban"]).optional(),
      requiresDisability: z.boolean().optional(),
      requiresBpl: z.boolean().optional(),
      requiresLand: z.boolean().optional(),
      requiresGirlChildUnder10: z.boolean().optional(),
      anyOf: z.array(RuleSet).optional(),
    })
    .strict(),
);

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD")
  .optional();

const text = (label: string) => z.string().trim().min(1, `${label} (English) is required`);
const opt = z
  .string()
  .trim()
  .transform((v) => v || undefined)
  .optional();

/** The editable fields of a scheme, as posted by the admin form. */
const SchemeForm = z
  .object({
    nameEn: text("Name"),
    nameHi: opt,
    nameMl: opt,
    summaryEn: text("Summary"),
    summaryHi: opt,
    summaryMl: opt,
    benefitsEn: text("Benefits"),
    benefitsHi: opt,
    benefitsMl: opt,
    howEn: text("How to apply"),
    howHi: opt,
    howMl: opt,
    ministry: z.string().trim().min(2, "Ministry is required"),
    level: z.enum(["central", "state"]),
    applyUrl: z.string().trim().url("Apply link must be a full URL").startsWith("https://", "Apply link must use https"),
    documents: z.string(),
    openDate: date,
    closeDate: date,
    rules: z.string(),
  })
  .refine((f) => !f.openDate || !f.closeDate || f.openDate <= f.closeDate, "Open date must be before the close date");

export type EditResult = { ok: true; scheme: Scheme } | { ok: false; error: string };

/** Validates the edit form and returns the updated scheme (or a readable error). */
export function applySchemeEdit(existing: Scheme, form: FormData): EditResult {
  const raw = Object.fromEntries(
    [...form.entries()].map(([k, v]) => [k, typeof v === "string" ? (k.endsWith("Date") && !v ? undefined : v) : ""]),
  );
  const parsed = SchemeForm.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid form" };
  const f = parsed.data;

  let rulesJson: unknown;
  try {
    rulesJson = JSON.parse(f.rules || "{}");
  } catch {
    return { ok: false, error: "Eligibility rules must be valid JSON" };
  }
  const rules = RuleSet.safeParse(rulesJson);
  if (!rules.success) {
    const i = rules.error.issues[0];
    return { ok: false, error: `Eligibility rules: ${i?.path.join(".") || "value"} ${i?.message ?? "is invalid"}` };
  }

  const now = new Date().toISOString();
  return {
    ok: true,
    scheme: {
      ...existing,
      name: { en: f.nameEn, hi: f.nameHi, ml: f.nameMl },
      summary: { en: f.summaryEn, hi: f.summaryHi, ml: f.summaryMl },
      benefits: { en: f.benefitsEn, hi: f.benefitsHi, ml: f.benefitsMl },
      howToApply: { en: f.howEn, hi: f.howHi, ml: f.howMl },
      ministry: f.ministry,
      level: f.level,
      applyUrl: f.applyUrl,
      documents: f.documents
        .split("\n")
        .map((d) => d.trim())
        .filter(Boolean),
      openDate: f.openDate,
      closeDate: f.closeDate,
      rules: rules.data,
      editedAt: now,
      updatedAt: now,
    },
  };
}
