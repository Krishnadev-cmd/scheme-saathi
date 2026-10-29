import { ChatsCircle, Command, TelegramLogo, Translate } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import ChatSimulator from "@/components/ChatSimulator";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { LINKS } from "@/lib/links";
import "../home.css";
import "./try.css";

export const metadata: Metadata = {
  title: "Live demo",
  description: "Try the Scheme Saathi conversation in your browser. It is the same flow as on Telegram and WhatsApp.",
};

const TIPS = [
  { icon: Translate, t: "Any language", d: "Type answers in English, हिन्दी or മലയാളം, or tap the buttons." },
  { icon: ChatsCircle, t: "Ask follow ups", d: "Reply with a number to open a scheme, or ask a question about it." },
  { icon: Command, t: "Commands", d: "menu · schemes · restart · language · alerts off · /delete" },
];

export default function TryPage() {
  return (
    <>
      <SiteNav />
      <main id="main" className="container try">
        <section className="try-copy load">
          <span className="eyebrow">Live demo</span>
          <h1 className="try-title">
            Try the full
            <br /> conversation here
          </h1>
          <p className="muted t-lg">
            This is the same agent that runs on Telegram and WhatsApp, connected to the real scheme catalogue.
          </p>
          <ul className="tips">
            {TIPS.map((t) => (
              <li key={t.t}>
                <span className="icon-tile">
                  <t.icon size={22} weight="duotone" aria-hidden />
                </span>
                <div>
                  <b>{t.t}</b>
                  <p className="muted t-sm">{t.d}</p>
                </div>
              </li>
            ))}
          </ul>
          {(LINKS.hasTelegram || LINKS.hasWhatsApp) && (
            <div className="cta-row">
              {LINKS.hasTelegram && (
                <a className="btn btn-primary" href={LINKS.telegram}>
                  <TelegramLogo size={20} weight="fill" aria-hidden /> Continue in Telegram
                </a>
              )}
              {LINKS.hasWhatsApp && (
                <a className="link-arrow" href={LINKS.whatsapp}>
                  or chat on WhatsApp →
                </a>
              )}
            </div>
          )}
        </section>
        <div className="load" style={{ "--d": "120ms" } as React.CSSProperties}>
          <ChatSimulator />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
