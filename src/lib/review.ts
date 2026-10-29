import { getScheme, listSchemes, upsertScheme } from "./db";
import { isLive } from "./eligibility";
import type { EligibilityRules, Scheme } from "./types";

/**
 * Review queue. Nothing the pipeline finds reaches users directly:
 *  - a new scheme is stored with review = "pending";
 *  - a new window for an existing scheme is stored as pendingWindow.
 * An admin approves or rejects each item; approval publishes it and triggers alerts.
 */

export const windowKey = (w: { openDate?: string; closeDate?: string }) => `${w.openDate ?? ""}..${w.closeDate ?? ""}`;

export async function proposeNewScheme(s: Scheme): Promise<void> {
  await upsertScheme({ ...s, review: "pending" });
}

/**
 * Queues a window change for an existing scheme. Returns false (and changes
 * nothing) if it matches the live window, the one already pending, or one an
 * admin rejected before.
 */
export async function proposeWindow(
  existing: Scheme,
  w: { openDate?: string; closeDate?: string },
  sourceUrl: string,
): Promise<boolean> {
  const key = windowKey(w);
  if (key === windowKey(existing)) return false;
  if (existing.pendingWindow && key === windowKey(existing.pendingWindow)) return false;
  if (existing.rejectedWindows?.includes(key)) return false;
  await upsertScheme({
    ...existing,
    pendingWindow: { openDate: w.openDate, closeDate: w.closeDate, sourceUrl, foundAt: new Date().toISOString() },
  });
  return true;
}

export interface ReviewQueue {
  newSchemes: Scheme[];
  windowChanges: Scheme[];
}

export async function listReviewQueue(): Promise<ReviewQueue> {
  const all = await listSchemes();
  return {
    newSchemes: all.filter((s) => s.review === "pending"),
    windowChanges: all.filter((s) => isLive(s) && s.pendingWindow),
  };
}

export async function countPendingReview(): Promise<number> {
  const q = await listReviewQueue();
  return q.newSchemes.length + q.windowChanges.length;
}

export type ReviewOutcome = { scheme: Scheme; kind: "new" | "window" } | undefined;

/** Publishes a pending scheme, or applies its pending window. */
export async function approve(id: string): Promise<ReviewOutcome> {
  const s = await getScheme(id);
  if (!s) return undefined;
  const now = new Date().toISOString();
  if (s.review === "pending") {
    const scheme: Scheme = { ...s, review: "approved", reviewedAt: now, updatedAt: now };
    await upsertScheme(scheme);
    return { scheme, kind: "new" };
  }
  if (s.pendingWindow) {
    const { openDate, closeDate, sourceUrl } = s.pendingWindow;
    const scheme: Scheme = {
      ...s,
      openDate,
      closeDate,
      sourceUrl,
      pendingWindow: undefined,
      reviewedAt: now,
      updatedAt: now,
    };
    await upsertScheme(scheme);
    return { scheme, kind: "window" };
  }
  return undefined;
}

/** Rejects a pending scheme (kept, so the pipeline won't re-add it) or its pending window. */
export async function reject(id: string): Promise<ReviewOutcome> {
  const s = await getScheme(id);
  if (!s) return undefined;
  const now = new Date().toISOString();
  if (s.review === "pending") {
    const scheme: Scheme = { ...s, review: "rejected", reviewedAt: now };
    await upsertScheme(scheme);
    return { scheme, kind: "new" };
  }
  if (s.pendingWindow) {
    const scheme: Scheme = {
      ...s,
      rejectedWindows: [...(s.rejectedWindows ?? []), windowKey(s.pendingWindow)],
      pendingWindow: undefined,
      reviewedAt: now,
    };
    await upsertScheme(scheme);
    return { scheme, kind: "window" };
  }
  return undefined;
}

const OCC: Record<string, string> = {
  farmer: "farmers",
  student: "students",
  salaried: "salaried",
  self_employed: "own business",
  street_vendor: "street vendors",
  artisan: "artisans",
  labourer: "daily wage workers",
  homemaker: "homemakers",
  unemployed: "unemployed",
  retired: "retired",
};

/** Plain English summary of a rule set, so a reviewer can check it quickly. */
export function describeRules(r: EligibilityRules): string[] {
  const out: string[] = [];
  if (r.minAge != null || r.maxAge != null) out.push(`Age ${r.minAge ?? 0}–${r.maxAge ?? "any"}`);
  if (r.genders?.length) out.push(`Gender: ${r.genders.join(", ")}`);
  if (r.occupations?.length) out.push(`For: ${r.occupations.map((o) => OCC[o] ?? o).join(", ")}`);
  if (r.categories?.length) out.push(`Category: ${r.categories.map((c) => c.toUpperCase()).join(", ")}`);
  if (r.maxIncome != null) out.push(`Family income up to ₹${r.maxIncome.toLocaleString("en-IN")}`);
  if (r.states?.length) out.push(`States: ${r.states.join(", ")}`);
  if (r.area) out.push(`${r.area === "rural" ? "Rural" : "Urban"} areas`);
  if (r.requiresDisability) out.push("Persons with disability");
  if (r.requiresBpl) out.push("BPL / priority ration card");
  if (r.requiresLand) out.push("Owns farm land");
  if (r.requiresGirlChildUnder10) out.push("Has a daughter under 10");
  if (r.anyOf?.length) out.push(`One of: ${r.anyOf.map((a) => describeRules(a).join(" + ")).join(" OR ")}`);
  return out.length ? out : ["No restrictions found: everyone would match"];
}
