import { createHash } from "node:crypto";
import { alertAdmin } from "../channels";
import {
  finishPipelineRun,
  getRunningPipelineRun,
  getScheme,
  getSourceHash,
  listSchemes,
  setSourceHash,
  tryStartPipelineRun,
  updatePipelineLog,
} from "../db";
import { env } from "../env";
import { extractSchemes, llmEnabled, type ExtractedScheme } from "../llm";
import { log as logger } from "../log";
import { captureError } from "../monitoring";
import { proposeNewScheme, proposeWindow } from "../review";
import type { EligibilityRules, Scheme } from "../types";
import { notifyUsers } from "./notify";
import { fetchSource, loadSources } from "./sources";

const MAX_PAGE_CHARS = 120_000;

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const isoDate = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

function findExisting(name: string, all: Scheme[]): Scheme | undefined {
  const n = norm(name);
  return all.find((s) => {
    const m = norm(s.name.en);
    return m === n || (n.length > 8 && (m.includes(n) || n.includes(m)));
  });
}

function toRules(r: ExtractedScheme["rules"]): EligibilityRules {
  const rules: EligibilityRules = {};
  if (r.minAge != null) rules.minAge = r.minAge;
  if (r.maxAge != null) rules.maxAge = r.maxAge;
  if (r.genders.length) rules.genders = r.genders;
  if (r.occupations.length) rules.occupations = r.occupations;
  if (r.categories.length) rules.categories = r.categories;
  if (r.maxIncome != null) rules.maxIncome = r.maxIncome;
  if (r.states.length) rules.states = r.states;
  if (r.area) rules.area = r.area;
  if (r.requiresDisability) rules.requiresDisability = true;
  if (r.requiresBpl) rules.requiresBpl = true;
  if (r.requiresLand) rules.requiresLand = true;
  if (r.requiresGirlChildUnder10) rules.requiresGirlChildUnder10 = true;
  return rules;
}

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";

/** Parses 31-10-2026, 31/10/2026, 31.10.2026 or 31 Oct 2026 / October 31, 2026. */
export function parseLooseDate(s: string): string | undefined {
  let m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})[a-z]*,?\\s+(20\\d{2})\\b`, "i"));
  if (!m) {
    const m2 = s.match(new RegExp(`\\b(${MONTHS})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, "i"));
    if (m2) m = [m2[0], m2[2], m2[1], m2[3]] as unknown as RegExpMatchArray;
  }
  if (!m) return undefined;
  const month = MONTHS.split("|").indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/**
 * Rule-based fallback when Groq isn't configured: look for a known scheme's
 * name followed closely by "last date … <date>" and record that as the close date.
 */
export function heuristicWindows(text: string, all: Scheme[]): { id: string; closeDate: string }[] {
  const found: { id: string; closeDate: string }[] = [];
  const lower = text.toLowerCase();
  for (const s of all) {
    const idx = lower.indexOf(s.name.en.toLowerCase());
    if (idx < 0) continue;
    const near = text.slice(idx, idx + 400);
    const m = near.match(/(last date|closing date|apply (?:till|by|before)|deadline|up ?to)[^\n]{0,40}/i);
    const date = m && parseLooseDate(m[0]);
    if (date) found.push({ id: s.id, closeDate: date });
  }
  return found;
}

export interface PipelineResult {
  runId: number;
  log: string[];
  /** New schemes queued for review. */
  newForReview: number;
  /** Window changes queued for review. */
  windowsForReview: number;
  failedSources: string[];
  notifications: { sent: number; skipped: number };
}

export class PipelineBusyError extends Error {
  constructor(public runningId?: number) {
    super(`Pipeline run #${runningId ?? "?"} is already in progress`);
  }
}

/** Claims the run lock. Returns the run id, or null if a run is already going. */
export async function beginPipelineRun(): Promise<number | null> {
  return tryStartPipelineRun();
}

export async function runningPipelineRunId(): Promise<number | undefined> {
  return (await getRunningPipelineRun())?.id;
}

/** Runs to completion in the caller (CLI, tests, ?wait=1). Throws PipelineBusyError if locked. */
export async function runPipeline(opts: { force?: boolean; notify?: boolean } = {}): Promise<PipelineResult> {
  const runId = await beginPipelineRun();
  if (runId == null) throw new PipelineBusyError(await runningPipelineRunId());
  return executePipelineRun(runId, opts);
}

/**
 * The run itself, for a run id already claimed with beginPipelineRun().
 * Findings go to the review queue; only approved schemes are alerted.
 */
export async function executePipelineRun(
  runId: number,
  opts: { force?: boolean; notify?: boolean } = {},
): Promise<PipelineResult> {
  const log: string[] = [];
  // Progress writes are chained so they land in order without blocking the run.
  let pending: Promise<void> = Promise.resolve();
  const push = (line: string) => {
    log.push(line);
    const text = log.join("\n");
    pending = pending.then(() => updatePipelineLog(runId, text)).catch(() => {});
  };
  const today = new Date().toISOString().slice(0, 10);
  const failedSources: string[] = [];
  let newForReview = 0;
  let windowsForReview = 0;

  const started = Date.now();
  const budgetMs = env().pipelineBudgetMs;
  try {
    push(llmEnabled() ? "Mode: Groq extraction" : "Mode: heuristic (set GROQ_API_KEY for AI extraction)");
    for (const src of loadSources()) {
      if (Date.now() - started > budgetMs) {
        push(`⏸ ${src.id}: time budget reached, left for the next run`);
        continue;
      }
      let text: string;
      try {
        text = await fetchSource(src);
      } catch (err) {
        failedSources.push(`${src.id} (${(err as Error).message})`);
        push(`✗ ${src.id}: fetch failed (${(err as Error).message})`);
        continue;
      }
      const hash = createHash("sha256").update(text).digest("hex");
      if (!opts.force && (await getSourceHash(src.url)) === hash) {
        push(`= ${src.id}: unchanged`);
        continue;
      }
      if (text.length > MAX_PAGE_CHARS) {
        push(`… ${src.id}: page is ${text.length} chars, only the first ${MAX_PAGE_CHARS} are analysed`);
        text = text.slice(0, MAX_PAGE_CHARS);
      }

      // Includes pending and rejected schemes, so known items are never re-added.
      const all = await listSchemes();
      if (llmEnabled()) {
        let items: ExtractedScheme[] = [];
        try {
          items = await extractSchemes(text, src.url, today);
        } catch (err) {
          failedSources.push(`${src.id} (extraction: ${(err as Error).message})`);
          push(`✗ ${src.id}: extraction failed (${(err as Error).message})`);
          continue;
        }
        for (const it of items) {
          const existing = findExisting(it.name.en, all);
          const openDate = isoDate(it.openDate);
          const closeDate = isoDate(it.closeDate);
          if (existing) {
            if (existing.review === "rejected" || existing.review === "pending") continue;
            if (!openDate && !closeDate) continue;
            if (await proposeWindow(existing, { openDate, closeDate }, src.url)) {
              windowsForReview++;
              push(`? ${src.id}: window for "${existing.name.en}" → ${openDate ?? "?"} – ${closeDate ?? "?"} (needs review)`);
            }
          } else {
            if (closeDate && closeDate < today) continue; // already closed
            let id = slug(it.name.en) || `scheme-${Date.now()}`;
            if (await getScheme(id)) id = `${id}-${Date.now().toString(36)}`; // never overwrite another scheme
            const scheme: Scheme = {
              id,
              name: it.name,
              ministry: it.ministry,
              level: it.level,
              summary: it.summary,
              benefits: it.benefits,
              howToApply: it.howToApply,
              documents: it.documents,
              applyUrl: it.applyUrl || src.url,
              rules: toRules(it.rules),
              openDate,
              closeDate,
              source: "pipeline",
              sourceUrl: src.url,
              updatedAt: new Date().toISOString(),
            };
            await proposeNewScheme(scheme);
            all.push({ ...scheme, review: "pending" });
            newForReview++;
            push(`? ${src.id}: new "${it.name.en}" (${openDate ?? "?"} – ${closeDate ?? "?"}) (needs review)`);
          }
        }
      } else {
        for (const w of heuristicWindows(text, all)) {
          const s = all.find((x) => x.id === w.id)!;
          if (s.review === "rejected" || s.review === "pending" || w.closeDate < today) continue;
          // Only the deadline is known: treat as open until then.
          if (await proposeWindow(s, { closeDate: w.closeDate }, src.url)) {
            windowsForReview++;
            push(`? ${src.id}: "${s.name.en}" open till ${w.closeDate} (needs review)`);
          }
        }
      }
      await setSourceHash(src.url, hash);
      push(`✓ ${src.id}: processed`);
    }

    // New schemes are alerted when approved; this sends reminders and windows that opened over time.
    const notifications = opts.notify === false ? { sent: 0, skipped: 0 } : await notifyUsers(await listSchemes(), new Set());
    push(`Review queue: ${newForReview} new, ${windowsForReview} window changes`);
    push(`Notifications: ${notifications.sent} sent, ${notifications.skipped} undeliverable`);
    await pending;
    await finishPipelineRun(runId, "ok", log.join("\n"));
    const result = { runId, log, newForReview, windowsForReview, failedSources, notifications };
    await reportToAdmin(result);
    return result;
  } catch (err) {
    log.push(`Fatal: ${(err as Error).stack ?? err}`);
    await pending;
    await finishPipelineRun(runId, "error", log.join("\n"));
    await captureError(err, { runId, stage: "pipeline" });
    await alertAdmin(`⚠️ Pipeline run #${runId} failed: ${(err as Error).message}\n${env().baseUrl}/admin`).catch(() => {});
    throw err;
  }
}

/** Tells the admin on Telegram when there is something to review or a source failed. */
async function reportToAdmin(r: PipelineResult) {
  const queued = r.newForReview + r.windowsForReview;
  if (!queued && !r.failedSources.length) return;
  const lines = [`📋 Pipeline run #${r.runId} finished.`];
  if (queued) lines.push(`${r.newForReview} new scheme(s) and ${r.windowsForReview} deadline change(s) are waiting for review.`);
  if (r.failedSources.length) lines.push(`Failed sources: ${r.failedSources.join("; ")}`);
  lines.push(`${env().baseUrl}/admin`);
  try {
    await alertAdmin(lines.join("\n"));
  } catch (err) {
    logger.warn("admin alert failed", { err });
  }
}
