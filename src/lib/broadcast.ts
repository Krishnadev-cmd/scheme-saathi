import { notifyUser } from "./channels";
import { createBroadcast, listUsers, updateBroadcast, type Broadcast } from "./db";
import { t } from "./i18n";
import { log } from "./log";
import type { User } from "./types";

export interface Audience {
  channel: "all" | "telegram" | "whatsapp";
  lang: "all" | "en" | "hi" | "ml";
}

/**
 * Who receives a broadcast: subscribed users who gave consent, on a real
 * channel (not the web demo), optionally filtered by channel and language.
 */
export async function audienceUsers(a: Audience): Promise<User[]> {
  return (await listUsers()).filter(
    (u) =>
      u.subscribed &&
      !!u.consentAt &&
      u.channel !== "web" &&
      (a.channel === "all" || u.channel === a.channel) &&
      (a.lang === "all" || u.lang === a.lang),
  );
}

const pause = () => new Promise((r) => setTimeout(r, 50));

/** Records the broadcast and returns its id; call deliverBroadcast() in the background to send it. */
export async function startBroadcast(message: Broadcast["message"], a: Audience): Promise<{ id: number; users: User[] }> {
  const users = await audienceUsers(a);
  return { id: await createBroadcast(message, a, users.length), users };
}

/**
 * Sends one message per user in their language (falls back to English).
 * WhatsApp users outside the 24 hour window get the approved template if one
 * is configured, otherwise they are skipped.
 */
export async function deliverBroadcast(id: number, message: Broadcast["message"], users: User[]): Promise<void> {
  let sent = 0;
  let skipped = 0;
  try {
    for (const u of users) {
      const text = t(message, u.lang);
      const ok = await notifyUser(u, { text }, { lang: u.lang, params: ["Scheme Saathi", text] }).catch(() => false);
      if (ok) sent++;
      else skipped++;
      if ((sent + skipped) % 20 === 0) await updateBroadcast(id, { sent, skipped });
      await pause();
    }
    await updateBroadcast(id, { sent, skipped, status: "done" });
    log.info("broadcast finished", { id, sent, skipped });
  } catch (err) {
    await updateBroadcast(id, { sent, skipped, status: "error" });
    log.error("broadcast failed", { id, err });
  }
}
