import { ORDER } from "./agent";
import { getCounters, listUsers } from "./db";
import type { Step, User } from "./types";

/** Every stage a user passes through, in order. */
export const FUNNEL: Step[] = ["language", "consent", ...ORDER];

const LABEL: Record<Step, string> = {
  language: "Language picker",
  consent: "Consent notice",
  age: "Age",
  gender: "Gender",
  state: "State",
  area: "Rural or urban",
  occupation: "Occupation",
  ownsLand: "Land (farmers only)",
  income: "Income band",
  category: "Category",
  disability: "Disability",
  bpl: "Ration card",
  girlChild: "Daughter under 10 (adults only)",
  done: "Saw their schemes",
};

const DAY_MS = 24 * 60 * 60 * 1000;

export interface FunnelRow {
  step: Step;
  label: string;
  /** Users who reached this stage or got past it. */
  reached: number;
  /** Users whose current stage is this one and who have been silent for over 24 hours. */
  stalled: number;
  /** Users at this stage and active in the last 24 hours. */
  inProgress: number;
}

/**
 * Drop-off funnel built from each user's current step. "Reached" means at this
 * step or beyond; "stalled" users are where people drop off. People who
 * declined consent or deleted their data are gone, so they're shown as
 * anonymous counters instead.
 */
export async function funnel(input?: User[], now = Date.now()) {
  const users = input ?? (await listUsers()).filter((u) => u.channel !== "web");
  const pos = (u: User) => FUNNEL.indexOf(u.step);
  const rows: FunnelRow[] = FUNNEL.map((step, i) => {
    const here = users.filter((u) => u.step === step);
    const stale = (u: User) => !u.lastInboundAt || now - Date.parse(u.lastInboundAt) > DAY_MS;
    return {
      step,
      label: LABEL[step],
      reached: users.filter((u) => pos(u) >= i).length,
      stalled: step === "done" ? 0 : here.filter(stale).length,
      inProgress: step === "done" ? here.length : here.filter((u) => !stale(u)).length,
    };
  });
  // Biggest drop: the non-final stage where the most users have stalled.
  const worst = rows.filter((r) => r.step !== "done").sort((a, b) => b.stalled - a.stalled)[0];
  const counters = await getCounters();
  return {
    total: users.length,
    rows,
    worstStep: worst && worst.stalled > 0 ? worst.step : undefined,
    byLanguage: count(users, (u) => u.lang),
    byChannel: count(users, (u) => u.channel),
    alertsOn: users.filter((u) => u.subscribed && u.step === "done").length,
    consentDeclined: counters.consent_declined ?? 0,
    dataDeleted: counters.data_deleted ?? 0,
  };
}

function count(users: User[], key: (u: User) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const u of users) out[key(u)] = (out[key(u)] ?? 0) + 1;
  return out;
}
