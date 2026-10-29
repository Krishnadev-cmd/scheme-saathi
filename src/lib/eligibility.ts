import type { EligibilityRules, Profile, Scheme } from "./types";

/**
 * Returns true when nothing in the profile rules the user out. Unknown profile
 * fields never disqualify — eligibility is indicative, and the official portal
 * makes the final decision.
 */
export function passes(rules: EligibilityRules, p: Profile): boolean {
  if (rules.minAge != null && p.age != null && p.age < rules.minAge) return false;
  if (rules.maxAge != null && p.age != null && p.age > rules.maxAge) return false;
  if (rules.genders?.length && p.gender && !rules.genders.includes(p.gender)) return false;
  if (rules.occupations?.length && p.occupation && !rules.occupations.includes(p.occupation)) return false;
  if (rules.categories?.length && p.category && !rules.categories.includes(p.category)) return false;
  if (rules.maxIncome != null && p.annualIncome != null && p.annualIncome > rules.maxIncome) return false;
  if (rules.states?.length && p.state && !rules.states.includes(p.state)) return false;
  if (rules.area && p.area && rules.area !== p.area) return false;
  if (rules.requiresDisability && p.disability === false) return false;
  if (rules.requiresBpl && p.bpl === false) return false;
  if (rules.requiresLand && p.ownsLand === false) return false;
  if (rules.requiresGirlChildUnder10 && p.hasGirlChildUnder10 === false) return false;
  if (rules.anyOf?.length && !rules.anyOf.some((r) => passes(r, p))) return false;
  return true;
}

export type WindowStatus = "rolling" | "open" | "upcoming" | "closed";

export function windowStatus(s: Scheme, now = new Date()): WindowStatus {
  if (!s.openDate && !s.closeDate) return "rolling";
  const day = now.toISOString().slice(0, 10);
  if (s.openDate && day < s.openDate) return "upcoming";
  if (s.closeDate && day > s.closeDate) return "closed";
  return "open";
}

/** How specifically a scheme targets this profile — used to rank results. */
function specificity(r: EligibilityRules): number {
  let n = 0;
  if (r.occupations?.length) n += 3;
  if (r.states?.length) n += 3;
  if (r.categories?.length) n += 2;
  if (r.requiresDisability || r.requiresGirlChildUnder10 || r.requiresLand) n += 2;
  if (r.genders?.length) n += 1;
  if (r.maxIncome != null) n += 1;
  if (r.requiresBpl) n += 1;
  if (r.minAge != null || r.maxAge != null) n += 1;
  return n;
}

/** Only approved schemes reach users; pipeline discoveries wait in the review queue. */
export function isLive(s: Scheme): boolean {
  return !s.hidden && s.review !== "pending" && s.review !== "rejected";
}

export function matchSchemes(schemes: Scheme[], p: Profile, now = new Date()): Scheme[] {
  const rank: Record<WindowStatus, number> = { open: 0, rolling: 1, upcoming: 2, closed: 3 };
  return schemes
    .filter((s) => isLive(s) && windowStatus(s, now) !== "closed" && passes(s.rules, p))
    .sort(
      (a, b) =>
        rank[windowStatus(a, now)] - rank[windowStatus(b, now)] || specificity(b.rules) - specificity(a.rules),
    );
}
