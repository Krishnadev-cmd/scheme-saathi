import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";
import { log } from "../log";
import type { Lang, OutMessage } from "../types";

const endpoint = () => {
  const wa = env().whatsapp;
  return `https://graph.facebook.com/${wa.apiVersion}/${wa.phoneNumberId}/messages`;
};

/** Calls the Cloud API. Returns false (never throws) when Meta refuses or can't be reached. */
async function post(body: Record<string, unknown>): Promise<boolean> {
  if (!env().whatsapp.enabled) return false;
  try {
    const res = await fetch(endpoint(), {
      method: "POST",
      headers: { Authorization: `Bearer ${env().whatsapp.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) log.error("WhatsApp send failed", { status: res.status, body: await res.text() });
    return res.ok;
  } catch (err) {
    log.error("WhatsApp send failed", { err });
    return false;
  }
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/**
 * Sends replies within the 24h customer-service window. Options become reply
 * buttons (≤3) or a list (≤10). Interactive bodies are capped at 1024 chars,
 * so long texts go out as a plain message followed by a short picker.
 */
export async function sendWhatsApp(to: string, messages: OutMessage[], pickerLabel = "Choose"): Promise<boolean> {
  let ok = true;
  for (const m of messages) {
    const options = m.options?.slice(0, 10) ?? [];
    if (!options.length) {
      ok = (await post({ to, type: "text", text: { body: clip(m.text, 4096), preview_url: false } })) && ok;
      continue;
    }
    let body = m.text;
    if (body.length > 1024) {
      ok = (await post({ to, type: "text", text: { body: clip(body, 4096), preview_url: false } })) && ok;
      body = "👇";
    }
    const interactive =
      options.length <= 3
        ? {
            type: "button",
            body: { text: body },
            action: {
              buttons: options.map((o) => ({ type: "reply", reply: { id: o.id, title: clip(o.label, 20) } })),
            },
          }
        : {
            type: "list",
            body: { text: body },
            action: {
              button: clip(pickerLabel, 20),
              sections: [
                {
                  title: clip(pickerLabel, 24),
                  rows: options.map((o) => ({
                    id: o.id.slice(0, 200),
                    title: clip(o.label, 24),
                    description: o.label.length > 24 ? clip(o.label, 72) : undefined,
                  })),
                },
              ],
            },
          };
    ok = (await post({ to, type: "interactive", interactive })) && ok;
  }
  return ok;
}

/** Business-initiated message outside the 24h window — requires an approved template. */
export async function sendWhatsAppTemplate(to: string, lang: Lang, params: string[]): Promise<boolean> {
  const { notifyTemplate: name, templateLang } = env().whatsapp;
  if (!name) return false;
  const code = templateLang[lang];
  return post({
    to,
    type: "template",
    template: {
      name,
      language: { code },
      components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: clip(p, 1000) })) }],
    },
  });
}

export function verifyWhatsAppSignature(rawBody: string, header: string | null): boolean {
  const { appSecret: secret } = env().whatsapp;
  // Unsigned requests are only tolerated in development (production config requires the secret).
  if (!secret) return !env().isProd;
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export interface WhatsAppInbound {
  id: string;
  from: string;
  text: string;
  optionId?: string;
}

/** Flattens a Cloud API webhook payload into the messages we care about. */
export function parseWhatsAppWebhook(payload: unknown): WhatsAppInbound[] {
  const out: WhatsAppInbound[] = [];
  const entries = (payload as { entry?: { changes?: { value?: { messages?: unknown[] } }[] }[] })?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      for (const raw of change.value?.messages ?? []) {
        const m = raw as {
          id: string;
          from: string;
          type: string;
          text?: { body: string };
          button?: { text: string; payload?: string };
          interactive?: { button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
        };
        if (m.type === "text" && m.text) out.push({ id: m.id, from: m.from, text: m.text.body });
        else if (m.type === "interactive") {
          const r = m.interactive?.button_reply ?? m.interactive?.list_reply;
          if (r) out.push({ id: m.id, from: m.from, text: r.title, optionId: r.id });
        } else if (m.type === "button" && m.button) {
          out.push({ id: m.id, from: m.from, text: m.button.payload || m.button.text });
        }
      }
    }
  }
  return out;
}
