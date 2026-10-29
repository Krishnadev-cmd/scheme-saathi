import { env } from "../env";
import { log } from "../log";
import type { OutMessage } from "../types";

const API = () => `https://api.telegram.org/bot${env().telegram.token}`;

/** Converts our WhatsApp-style *bold* / _italic_ markup to Telegram HTML. */
export function toTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,:!?])/gm, "$1<b>$2</b>")
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,:!?])/gm, "$1<i>$2</i>");
}

/** Calls the Bot API. Returns false (never throws) when Telegram refuses or can't be reached. */
async function call(method: string, body: unknown): Promise<boolean> {
  if (!env().telegram.token) return false;
  try {
    const res = await fetch(`${API()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return true;
    // 403 means the user blocked the bot: expected, so not an error alert.
    const level = res.status === 403 ? "warn" : "error";
    log[level](`Telegram ${method} failed`, { status: res.status, body: await res.text() });
    return false;
  } catch (err) {
    log.error(`Telegram ${method} failed`, { err });
    return false;
  }
}

/** Sends the messages in order; returns false if any of them failed. */
export async function sendTelegram(chatId: string, messages: OutMessage[]): Promise<boolean> {
  let ok = true;
  for (const m of messages) {
    ok =
      (await call("sendMessage", {
      chat_id: chatId,
      text: toTelegramHtml(m.text).slice(0, 4096),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: m.options?.length
        ? { inline_keyboard: m.options.map((o) => [{ text: o.label.slice(0, 64), callback_data: o.id.slice(0, 64) }]) }
        : undefined,
      })) && ok;
  }
  return ok;
}

export async function answerCallback(callbackQueryId: string): Promise<void> {
  await call("answerCallbackQuery", { callback_query_id: callbackQueryId });
}

export async function setTelegramWebhook(baseUrl: string): Promise<unknown> {
  const res = await fetch(`${API()}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`,
      secret_token: env().telegram.webhookSecret,
      allowed_updates: ["message", "callback_query"],
    }),
  });
  return res.json();
}

/** Minimal shape of the Telegram updates we handle. */
export interface TelegramUpdate {
  update_id?: number;
  message?: { chat: { id: number }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number } } };
}
