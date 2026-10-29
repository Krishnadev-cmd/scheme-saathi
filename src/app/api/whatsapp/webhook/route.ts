import { after } from "next/server";
import { handleMessage } from "@/lib/agent";
import { parseWhatsAppWebhook, sendWhatsApp, verifyWhatsAppSignature } from "@/lib/channels/whatsapp";
import { claimMessage, getOrCreateUser } from "@/lib/db";
import { env } from "@/lib/env";
import { STR, t } from "@/lib/i18n";
import { log } from "@/lib/log";
import { safeEqual } from "@/lib/security";

export const runtime = "nodejs";

/** Meta's webhook verification handshake. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (
    url.searchParams.get("hub.mode") === "subscribe" &&
    safeEqual(url.searchParams.get("hub.verify_token"), env().whatsapp.verifyToken)
  ) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  if (!env().whatsapp.enabled) return new Response("whatsapp disabled", { status: 404 });
  const raw = await req.text();
  if (!verifyWhatsAppSignature(raw, req.headers.get("x-hub-signature-256"))) {
    log.warn("whatsapp webhook rejected: invalid signature");
    return new Response("invalid signature", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const inbound = parseWhatsAppWebhook(payload);

  after(async () => {
    for (const m of inbound) {
      try {
        // Meta retries deliveries; the claim is shared across serverless instances.
        if (!(await claimMessage(`whatsapp:${m.id}`))) continue;
        const user = await getOrCreateUser("whatsapp", m.from);
        const replies = await handleMessage(user, { text: m.text, optionId: m.optionId });
        await sendWhatsApp(m.from, replies, t(STR.choose, user.lang));
      } catch (err) {
        log.error("whatsapp webhook error", { err });
      }
    }
  });
  return new Response("ok", { status: 200 });
}
