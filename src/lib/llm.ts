import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { env } from "./env";
import { t } from "./i18n";
import { log } from "./log";
import type { Lang, Profile, Scheme } from "./types";

/**
 * Optional Groq layer. Every caller has a rule-based fallback, so the bot
 * keeps working when GROQ_API_KEY is not set or a call fails.
 */

let client: OpenAI | undefined;

export function llmEnabled(): boolean {
  return !!env().groq.apiKey;
}

function getClient(): OpenAI {
  client ??= new OpenAI({
    apiKey: env().groq.apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
  return client;
}

const LANG_NAME: Record<Lang, string> = { en: "English", hi: "Hindi", ml: "Malayalam" };

async function parseJson<T extends z.ZodType>(
  schema: T,
  system: string,
  user: string,
  effort: "low" | "medium" = "low",
): Promise<z.infer<T> | null> {
  const res = await getClient().chat.completions.parse({
    model: env().groq.model,
    max_tokens: 16000,
    reasoning_effort: effort,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: zodResponseFormat(schema, "response"),
  });
  return (res.choices[0]?.message.parsed as z.infer<T> | null) ?? null;
}

/** Maps a free-text reply ("I grow paddy", "मैं किसान हूँ") to one of the offered option ids. */
export async function interpretChoice(
  question: string,
  reply: string,
  options: { id: string; label: string }[],
): Promise<string | null> {
  if (!llmEnabled()) return null;
  try {
    const out = await parseJson(
      z.object({ optionId: z.string().nullable() }),
      "You map a citizen's chat reply (English, Hindi, Malayalam or mixed/transliterated) to one of the offered option ids. Return null when the reply doesn't clearly fit any option.",
      `Question: ${question}\nOptions:\n${options.map((o) => `- ${o.id}: ${o.label}`).join("\n")}\nReply: ${reply}`,
    );
    const id = out?.optionId;
    return id && options.some((o) => o.id === id) ? id : null;
  } catch (err) {
    log.error("interpretChoice failed", { err });
    return null;
  }
}

/** Extracts an age or Indian state/UT name from a free-text reply. */
export async function interpretValue(kind: "age" | "state", reply: string): Promise<string | null> {
  if (!llmEnabled()) return null;
  try {
    const out = await parseJson(
      z.object({ value: z.string().nullable() }),
      kind === "age"
        ? "Extract the person's age in whole years from the reply (any language). Return digits only, or null."
        : "Extract the Indian state or union territory the person lives in from the reply (any language or script). Return its standard English name (e.g. 'Kerala', 'Tamil Nadu', 'Jammu and Kashmir'), or null.",
      reply,
    );
    return out?.value ?? null;
  } catch (err) {
    log.error("interpretValue failed", { err });
    return null;
  }
}

/** Answers a free-form question about schemes, grounded in the user's matched schemes. */
export async function answerQuestion(
  question: string,
  lang: Lang,
  profile: Profile,
  matched: Scheme[],
): Promise<string | null> {
  if (!llmEnabled()) return null;
  const context = matched
    .slice(0, 15)
    .map(
      (s) =>
        `### ${s.name.en}\n${t(s.summary, "en")}\nBenefits: ${t(s.benefits, "en")}\nHow to apply: ${t(s.howToApply, "en")}\nDocuments: ${s.documents.join(", ")}\nLink: ${s.applyUrl}` +
        (s.closeDate ? `\nApplications close: ${s.closeDate}` : ""),
    )
    .join("\n\n");
  try {
    const res = await getClient().chat.completions.create({
      model: env().groq.model,
      max_tokens: 16000,
      messages: [
        {
          role: "system",
          content:
            `You are Scheme Saathi, a friendly assistant on WhatsApp/Telegram helping Indian citizens understand government schemes. ` +
            `Reply in ${LANG_NAME[lang]} in under 120 words, using simple words and WhatsApp formatting (*bold*). ` +
            `Use only the scheme information provided; if unsure, say so and point to the official link. ` +
            `Never ask for Aadhaar, PAN, bank, card or other identity numbers. Remind users to confirm eligibility on the official portal when relevant.\n\n` +
            `User profile: ${JSON.stringify(profile)}\n\nSchemes the user may be eligible for:\n${context || "(none matched yet)"}`,
        },
        { role: "user", content: question },
      ],
    });
    const text = res.choices[0]?.message.content?.trim() ?? "";
    return text || null;
  } catch (err) {
    log.error("answerQuestion failed", { err });
    return null;
  }
}

const LocalizedZ = z.object({ en: z.string(), hi: z.string(), ml: z.string() });

export const ExtractedSchemeZ = z.object({
  name: LocalizedZ,
  ministry: z.string(),
  level: z.enum(["central", "state"]),
  summary: LocalizedZ,
  benefits: LocalizedZ,
  howToApply: LocalizedZ,
  documents: z.array(z.string()),
  applyUrl: z.string().describe("Official application / scheme URL; empty string if not found"),
  openDate: z.string().nullable().describe("YYYY-MM-DD application start date, or null"),
  closeDate: z.string().nullable().describe("YYYY-MM-DD application last date, or null"),
  rules: z.object({
    minAge: z.number().nullable(),
    maxAge: z.number().nullable(),
    genders: z.array(z.enum(["male", "female", "transgender"])),
    occupations: z.array(
      z.enum([
        "farmer",
        "student",
        "salaried",
        "self_employed",
        "street_vendor",
        "artisan",
        "labourer",
        "homemaker",
        "unemployed",
        "retired",
      ]),
    ),
    categories: z.array(z.enum(["general", "obc", "sc", "st", "ews", "minority"])),
    maxIncome: z.number().nullable().describe("Max annual family income in rupees, or null"),
    states: z.array(z.string()).describe("English state/UT names; empty for all-India"),
    area: z.enum(["rural", "urban"]).nullable(),
    requiresDisability: z.boolean(),
    requiresBpl: z.boolean(),
    requiresLand: z.boolean(),
    requiresGirlChildUnder10: z.boolean(),
  }),
});
export type ExtractedScheme = z.infer<typeof ExtractedSchemeZ>;

/**
 * Reads a scraped government page and returns schemes / application portals it
 * announces, with windows, eligibility rules and en/hi/ml translations.
 */
export async function extractSchemes(pageText: string, sourceUrl: string, today: string): Promise<ExtractedScheme[]> {
  if (!llmEnabled()) return [];
  const out = await parseJson(
    z.object({ schemes: z.array(ExtractedSchemeZ) }),
    "You extract Indian government welfare schemes, scholarships and application/registration portals from scraped web pages. " +
      "Only include items for individual citizens (not tenders, recruitments for govt jobs, or internal circulars). " +
      "Capture the application window if stated. Leave a rule empty/null/false when the page does not state it — never guess. " +
      "Write name, summary, benefits and howToApply in English, Hindi and Malayalam, in short plain sentences. " +
      "If the page has nothing relevant, return an empty list.",
    `Today: ${today}\nSource URL: ${sourceUrl}\n\nPage content:\n${pageText}`,
    "medium",
  );
  return out?.schemes ?? [];
}
