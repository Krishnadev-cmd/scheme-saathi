import { after } from "next/server";
import { handleMessage } from "@/lib/agent";
import { answerCallback, sendTelegram, type TelegramUpdate } from "@/lib/channels/telegram";
import { claimMessage, getOrCreateUser } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { safeEqual } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const cfg = env();
  if (!cfg.telegram.enabled) return new Response("telegram disabled", { status: 404 });
  const secret = cfg.telegram.webhookSecret;
  // Production config always has a secret; development tolerates its absence.
  if (secret ? !safeEqual(req.headers.get("x-telegram-bot-api-secret-token"), secret) : cfg.isProd) {
    log.warn("telegram webhook rejected: bad secret");
    return new Response("forbidden", { status: 403 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  // Acknowledge immediately; Groq calls can take a few seconds.
  after(async () => {
    try {
      // Telegram retries undelivered updates; skip ones another instance already handled.
      if (update.update_id != null && !(await claimMessage(`telegram:${update.update_id}`))) return;
      if (update.callback_query?.message) {
        const cq = update.callback_query;
        await answerCallback(cq.id);
        const chatId = String(cq.message!.chat.id);
        const user = await getOrCreateUser("telegram", chatId);
        const replies = await handleMessage(user, { text: cq.data ?? "", optionId: cq.data });
        await sendTelegram(chatId, replies);
      } else if (update.message?.text) {
        const chatId = String(update.message.chat.id);
        const user = await getOrCreateUser("telegram", chatId);
        // Deep links (t.me/<bot>?start=hi) arrive as "/start hi"; drop the payload.
        const text = update.message.text.startsWith("/start") ? "/start" : update.message.text;
        const replies = await handleMessage(user, { text });
        await sendTelegram(chatId, replies);
      }
    } catch (err) {
      log.error("telegram webhook error", { err });
    }
  });
  return Response.json({ ok: true });
}
