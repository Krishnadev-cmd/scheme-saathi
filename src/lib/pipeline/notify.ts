import { notifyUser } from "../channels";
import { listUsers, markNotified, unmarkNotified, wasNotified } from "../db";
import { isLive, passes, windowStatus } from "../eligibility";
import { STR, fmt, formatDate, t } from "../i18n";
import type { Scheme } from "../types";

const CLOSING_SOON_DAYS = 3;
// Stay well under channel rate limits.
const pause = () => new Promise((r) => setTimeout(r, 50));

function daysUntil(iso: string, now: Date): number {
  return Math.ceil((Date.parse(iso + "T23:59:59") - now.getTime()) / 86_400_000);
}

/**
 * Alerts subscribed, eligible users about
 *  - schemes whose application window is open (or that the pipeline just discovered), once;
 *  - windows closing within CLOSING_SOON_DAYS, once.
 * Seed schemes without a window are always available, so they never trigger alerts.
 */
export async function notifyUsers(schemes: Scheme[], newlyDiscovered: Set<string>, now = new Date()) {
  const users = (await listUsers()).filter((u) => u.subscribed && u.step === "done" && u.channel !== "web");
  let sent = 0;
  let skipped = 0;

  for (const s of schemes) {
    if (!isLive(s)) continue; // pending or rejected: never alerted
    const status = windowStatus(s, now);
    const opened = status === "open" || (status === "rolling" && newlyDiscovered.has(s.id));
    const closingSoon = status === "open" && !!s.closeDate && daysUntil(s.closeDate, now) <= CLOSING_SOON_DAYS;
    if (!opened && !closingSoon) continue;

    for (const u of users) {
      if (!passes(s.rules, u.profile)) continue;
      const L = u.lang;
      const name = t(s.name, L);
      // Keyed by window so the next year's round notifies again.
      const win = `${s.openDate ?? ""}..${s.closeDate ?? ""}`;
      const openedKey = `opened:${win}`;
      const closingKey = `closing_soon:${win}`;

      if (opened && !(await wasNotified(u.id, s.id, openedKey))) {
        const till = s.closeDate ? fmt(t(STR.tillSuffix, L), { date: formatDate(s.closeDate, L) }) : "";
        const text = fmt(t(STR.notifyOpened, L), { name, till, benefit: t(s.benefits, L), url: s.applyUrl });
        // Claim first so concurrent runs can't double-send; release on failure.
        if (await markNotified(u.id, s.id, openedKey)) {
          const ok = await notifyUser(u, { text }, { lang: L, params: [name, `${t(s.benefits, L)} ${s.applyUrl}`] });
          await pause();
          if (ok) sent++;
          else {
            await unmarkNotified(u.id, s.id, openedKey);
            skipped++;
          }
        }
      } else if (closingSoon && !(await wasNotified(u.id, s.id, closingKey))) {
        const text = fmt(t(STR.notifyClosing, L), { name, date: formatDate(s.closeDate!, L), url: s.applyUrl });
        if (await markNotified(u.id, s.id, closingKey)) {
          const ok = await notifyUser(u, { text }, { lang: L, params: [name, text] });
          await pause();
          if (ok) sent++;
          else {
            await unmarkNotified(u.id, s.id, closingKey);
            skipped++;
          }
        }
      }
    }
  }
  return { sent, skipped };
}
