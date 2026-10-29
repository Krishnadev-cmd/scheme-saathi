import { env } from "../env";
import type { Lang, OutMessage, User } from "../types";
import { sendTelegram } from "./telegram";
import { sendWhatsApp, sendWhatsAppTemplate } from "./whatsapp";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sends a proactive notification. WhatsApp only allows free-form messages
 * within 24h of the user's last message; after that an approved template is
 * required. Returns false if the message could not be delivered.
 */
export async function notifyUser(
  user: User,
  message: OutMessage,
  template: { lang: Lang; params: string[] },
): Promise<boolean> {
  switch (user.channel) {
    case "telegram":
      return sendTelegram(user.externalId, [message]);
    case "whatsapp": {
      const inWindow = user.lastInboundAt && Date.now() - Date.parse(user.lastInboundAt) < DAY_MS;
      if (inWindow) return sendWhatsApp(user.externalId, [message]);
      return sendWhatsAppTemplate(user.externalId, template.lang, template.params);
    }
    case "web":
      return false; // the simulator has no push channel
  }
}

/** Messages the operator on Telegram (ADMIN_TELEGRAM_CHAT_ID). Does nothing when unset. */
export async function alertAdmin(text: string): Promise<void> {
  const { telegram, adminTelegramChatId } = env();
  if (!telegram.enabled || !adminTelegramChatId) return;
  await sendTelegram(adminTelegramChatId, [{ text }]);
}
