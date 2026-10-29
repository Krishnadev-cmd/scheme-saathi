/**
 * Public entry points. Telegram is the primary channel, WhatsApp the secondary.
 * Set NEXT_PUBLIC_TELEGRAM_BOT (bot username) and NEXT_PUBLIC_WHATSAPP_NUMBER
 * (country code + number, digits only) to deep link the CTAs; until the
 * Telegram bot is set, the primary CTA opens the in browser demo.
 */
const tg = process.env.NEXT_PUBLIC_TELEGRAM_BOT?.replace(/^@/, "");
const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");

export const LINKS = {
  telegram: tg ? `https://t.me/${tg}?start=hi` : "/try",
  whatsapp: wa ? `https://wa.me/${wa}?text=hi` : "/try",
  demo: "/try",
  hasTelegram: !!tg,
  hasWhatsApp: !!wa,
  telegramHandle: tg ? `@${tg}` : undefined,
};

/** The one main call to action used in the nav, hero and final section. */
export const PRIMARY = {
  href: LINKS.telegram,
  label: tg ? "Open in Telegram" : "Try Scheme Saathi",
  isTelegram: !!tg,
};
