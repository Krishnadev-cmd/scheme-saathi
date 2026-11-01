import {
  BellRinging,
  ChatsCircle,
  ClipboardText,
  FileMagnifyingGlass,
  HandWaving,
  ListChecks,
  LockKey,
  MapTrifold,
  ShieldCheck,
  TelegramLogo,
  Timer,
  Translate,
  TrashSimple,
  WarningCircle,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import dynamic from "next/dynamic";
import type { Metadata } from "next";
import HeroChat from "@/components/HeroChat";
import Reveal from "@/components/Reveal";
import type { SchemeCard } from "@/components/SchemeExplorer";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import TaglineReveal from "@/components/TaglineReveal";
import { env } from "@/lib/env";
import { LINKS, PRIMARY } from "@/lib/links";
import { DEFAULT_SOURCES } from "@/lib/pipeline/sources";
import { seedSchemes } from "@/lib/schemes/seed";
import type { Scheme } from "@/lib/types";
import "./home.css";

const SchemeExplorer = dynamic(() => import("@/components/SchemeExplorer"));

export const metadata: Metadata = {
  title: { absolute: "Scheme Saathi · Find the government schemes you can claim" },
  description:
    "Find Indian government schemes you may be eligible for. Scheme Saathi matches you to central and state benefits in English, Hindi and Malayalam.",
  alternates: { canonical: "/" },
};

function tagsFor(s: Scheme): string[] {
  const r = s.rules;
  const tags: string[] = [];
  if (r.occupations?.includes("farmer")) tags.push("farmers");
  if (r.occupations?.includes("student") || (r.maxAge != null && r.maxAge <= 30)) tags.push("students");
  if (r.genders?.includes("female") || r.requiresGirlChildUnder10 || r.anyOf?.some((a) => a.genders?.includes("female")))
    tags.push("women");
  if (r.minAge != null && r.minAge >= 60) tags.push("seniors");
  if (r.occupations?.some((o) => ["labourer", "street_vendor", "artisan", "self_employed"].includes(o))) tags.push("workers");
  if (r.requiresDisability || /health|hospital|treatment/i.test(s.summary.en + s.benefits.en)) tags.push("health");
  if (r.states?.includes("Kerala")) tags.push("kerala");
  return tags;
}

const SCHEMES = seedSchemes();
const CARDS: SchemeCard[] = SCHEMES.map((s) => ({
  id: s.id,
  name: s.name.en,
  benefit: s.benefits.en,
  ministry: s.ministry,
  level: s.level,
  url: s.applyUrl,
  tags: tagsFor(s),
}));

const PROBLEMS = [
  {
    icon: MapTrifold,
    title: "Scattered across portals",
    body: "Every ministry and state runs its own website, each with its own login and its own rules.",
  },
  {
    icon: FileMagnifyingGlass,
    title: "Rules written for officials",
    body: "Eligibility hides in long notifications full of income slabs, categories and exceptions.",
  },
  {
    icon: Timer,
    title: "Windows that close quietly",
    body: "Scholarships and internship rounds open for a few weeks a year. Most people hear about them too late.",
  },
];

const BENEFITS = [
  {
    icon: ListChecks,
    title: "Matched in about two minutes",
    body: "Eleven quick questions about age, work, income and family. Tap a button or just type. No forms, no login.",
    wide: true,
  },
  {
    icon: Translate,
    title: "Speaks your language",
    body: "English, हिन्दी and മലയാളം. Send “language” any time to switch.",
  },
  {
    icon: ClipboardText,
    title: "Exactly how to apply",
    body: "Benefits, documents to keep ready and the official link, for every scheme it suggests.",
  },
  {
    icon: BellRinging,
    title: "Alerts before deadlines",
    body: "When a portal opens for people like you, Saathi messages you, then reminds you three days before it closes.",
    wide: true,
  },
];

const STEPS = [
  { icon: HandWaving, title: "Say hi", body: "Open Scheme Saathi in Telegram (or WhatsApp), tap Start and pick your language." },
  { icon: ChatsCircle, title: "Answer a few questions", body: "Age, state, work, income band and a few yes or no questions." },
  { icon: BellRinging, title: "Get your schemes", body: "See what you qualify for, how to apply, and get alerts when new windows open." },
];

const FAQ = [
  {
    q: "Is Scheme Saathi a government service?",
    a: "No. It is an independent assistant that points you to official government portals. You always apply on the official website or at a government help centre.",
  },
  {
    q: "Which app should I use, Telegram or WhatsApp?",
    a: "Telegram is the main home of Scheme Saathi: open the bot, tap Start, and it can send you deadline alerts at any time. The same assistant also works on WhatsApp if you prefer it.",
  },
  {
    q: "Does it cost anything?",
    a: "No. Using Scheme Saathi is free. Your usual mobile data charges apply.",
  },
  {
    q: "What information does it ask for?",
    a: "Your age, gender, state, whether you live in a village or town, your work, family income band, social category, and a few yes or no questions about disability, ration card and children. Nothing that identifies you personally.",
  },
  {
    q: "Will it ask for my Aadhaar, PAN or bank details?",
    a: "Never. If someone sends an ID or card number by mistake, Saathi refuses it and does not save that message. Share such details only on the official portal when you apply.",
  },
  {
    q: "Which schemes does it cover?",
    a: `${SCHEMES.length} central and Kerala schemes today, covering farmers, students, women, seniors, workers, housing, health and disability. New schemes and application windows are added by a daily check of official portals.`,
  },
  {
    q: "Can it apply on my behalf?",
    a: "No. It tells you the benefits, the documents to keep ready and the official link. You can apply yourself or visit a Common Service Centre or Akshaya centre for help.",
  },
  {
    q: "How accurate is the eligibility check?",
    a: "It checks the main published rules such as age, income and occupation. The final decision is always made by the department, so treat the result as a strong starting point.",
  },
  {
    q: "How do I stop alerts or change my answers?",
    a: "Send “alerts off” to stop notifications, “restart” to answer the questions again, or “language” to switch language.",
  },
];

/** Telegram is the main call to action; WhatsApp is offered as the alternative. */
function Cta({ dark = false }: { dark?: boolean }) {
  return (
    <div className="cta-row">
      <a className="btn btn-primary" href={PRIMARY.href}>
        {PRIMARY.isTelegram ? (
          <TelegramLogo size={20} weight="fill" aria-hidden />
        ) : (
          <ChatsCircle size={20} weight="fill" aria-hidden />
        )}
        {PRIMARY.label}
      </a>
      {LINKS.hasWhatsApp ? (
        <a className={`link-arrow ${dark ? "on-dark" : ""}`} href={LINKS.whatsapp}>
          or chat on WhatsApp →
        </a>
      ) : (
        // Without a Telegram bot the primary CTA already opens the demo.
        PRIMARY.isTelegram && (
          <a className={`link-arrow ${dark ? "on-dark" : ""}`} href={LINKS.demo}>
            Try the demo in your browser →
          </a>
        )
      )}
    </div>
  );
}

function ChannelStrip() {
  return (
    <div className="channel-strip">
      <span className="faint t-sm">Works on</span>
      <span className="channel tg">
        <TelegramLogo size={18} weight="fill" aria-hidden /> Telegram
      </span>
      <span className="channel wa">
        <WhatsappLogo size={18} weight="fill" aria-hidden /> WhatsApp
      </span>
    </div>
  );
}

export default function Home() {
  const baseUrl = env().baseUrl;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Scheme Saathi",
        url: baseUrl,
        description:
          "A multilingual service that helps people find Indian government schemes and official application links.",
      },
      {
        "@type": "WebSite",
        name: "Scheme Saathi",
        url: baseUrl,
        description:
          "Find Indian government schemes you may be eligible for in English, Hindi and Malayalam.",
        inLanguage: ["en-IN", "hi-IN", "ml-IN"],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteNav />
      <main id="main">
        {/* Hero */}
        <section className="hero container">
          <div className="hero-copy">
            <span className="eyebrow load" style={{ "--d": "0ms" } as React.CSSProperties}>
              <ShieldCheck size={16} weight="fill" aria-hidden /> Free · No Aadhaar or PAN needed
            </span>
            <h1 className="hero-title load" style={{ "--d": "80ms" } as React.CSSProperties}>
              Find the government schemes your family can claim
            </h1>
            <p className="hero-sub load" style={{ "--d": "160ms" } as React.CSSProperties}>
              Scheme Saathi asks a few simple questions on Telegram, matches you to central and state
              schemes, and tells you exactly where to apply. In English, हिन्दी or മലയാളം.
            </p>
            <div className="load" style={{ "--d": "240ms" } as React.CSSProperties}>
              <Cta />
              <ChannelStrip />
            </div>
            <dl className="hero-stats load" style={{ "--d": "320ms" } as React.CSSProperties}>
              <div>
                <dt>{SCHEMES.length}</dt>
                <dd>schemes checked for you</dd>
              </div>
              <div>
                <dt>3</dt>
                <dd>languages</dd>
              </div>
              <div>
                <dt>{DEFAULT_SOURCES.length}</dt>
                <dd>official portals watched daily</dd>
              </div>
            </dl>
          </div>
          <div className="hero-visual load" style={{ "--d": "200ms" } as React.CSSProperties}>
            <HeroChat />
          </div>
        </section>

        {/* Problem */}
        <section className="section band-mist" aria-labelledby="problem-title">
          <div className="container">
            <Reveal className="section-head">
              <span className="eyebrow">The problem</span>
              <h2 id="problem-title" className="section-title">
                Help exists.
                <br /> Finding it is the hard part.
              </h2>
            </Reveal>
            <div className="problem-grid">
              {PROBLEMS.map((p, i) => (
                <Reveal key={p.title} className="problem-card" delay={i * 80}>
                  <span className="icon-tile warm">
                    <p.icon size={24} weight="duotone" aria-hidden />
                  </span>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Tagline */}
        <section className="section tagline-section" aria-label="Our promise">
          <div className="container">
            <TaglineReveal
              lines={["The schemes you qualify for", "should find you, not the", "other way around."]}
            />
          </div>
        </section>

        {/* Benefits */}
        <section className="section" aria-labelledby="benefits-title">
          <div className="container">
            <Reveal className="section-head">
              <span className="eyebrow">What Saathi does</span>
              <h2 id="benefits-title" className="section-title">
                A caseworker in your chat,
                <br /> available any hour
              </h2>
            </Reveal>
            <div className="bento">
              {BENEFITS.map((b, i) => (
                <Reveal key={b.title} className={`bento-card ${b.wide ? "wide" : ""}`} delay={i * 80}>
                  <span className="icon-tile">
                    <b.icon size={24} weight="duotone" aria-hidden />
                  </span>
                  <h3>{b.title}</h3>
                  <p>{b.body}</p>
                  {b.title.startsWith("Alerts") && (
                    <div className="alert-preview" aria-hidden>
                      <BellRinging size={18} weight="fill" />
                      <span>
                        <b>Post Matric Scholarship</b> is open for applications till 30 Nov
                      </span>
                    </div>
                  )}
                  {b.title.startsWith("Matched") && (
                    <div className="progress-preview" aria-hidden>
                      {Array.from({ length: 11 }, (_, n) => (
                        <span key={n} style={{ "--n": n } as React.CSSProperties} />
                      ))}
                    </div>
                  )}
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="section band-night" aria-labelledby="how-title">
          <div className="container">
            <Reveal className="section-head">
              <span className="eyebrow on-dark">How it works</span>
              <h2 id="how-title" className="section-title on-dark">
                Three steps, one chat
              </h2>
            </Reveal>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.title} className="step" delay={i * 100}>
                  <span className="step-num">{i + 1}</span>
                  <s.icon size={28} weight="duotone" aria-hidden className="step-icon" />
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Schemes */}
        <section id="schemes" className="section" aria-labelledby="schemes-title">
          <div className="container">
            <Reveal className="section-head split">
              <div>
                <span className="eyebrow">Schemes covered today</span>
                <h2 id="schemes-title" className="section-title">
                  From PM-KISAN to Kerala
                  <br /> welfare pensions
                </h2>
              </div>
              <p className="muted t-lg head-note">
                Saathi checks every scheme below against your answers. New schemes and application windows are added
                from {DEFAULT_SOURCES.length} official portals every morning.
              </p>
            </Reveal>
            <Reveal>
              <SchemeExplorer schemes={CARDS} />
            </Reveal>
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="section band-mist" aria-labelledby="privacy-title">
          <div className="container privacy">
            <Reveal className="privacy-copy">
              <span className="eyebrow">Privacy first</span>
              <h2 id="privacy-title" className="section-title">
                Built so you never
                <br /> overshare
              </h2>
              <p className="muted t-lg">
                Scheme Saathi only needs broad facts like your age group and work. It is designed to keep identity
                documents out of the conversation entirely.
              </p>
            </Reveal>
            <ul className="privacy-list">
              {[
                { icon: LockKey, t: "No ID numbers, ever", d: "It never asks for Aadhaar, PAN, bank, card or passport numbers." },
                { icon: WarningCircle, t: "Mistakes are caught", d: "If an ID number is sent by mistake, Saathi refuses it and does not store it." },
                { icon: TrashSimple, t: "You stay in control", d: "Send “alerts off” to stop messages, or “restart” to clear your answers." },
              ].map((p, i) => (
                <Reveal as="li" key={p.t} delay={i * 80}>
                  <span className="icon-tile">
                    <p.icon size={22} weight="duotone" aria-hidden />
                  </span>
                  <div>
                    <h3>{p.t}</h3>
                    <p className="muted">{p.d}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="section" aria-labelledby="faq-title">
          <div className="container faq-wrap">
            <Reveal className="section-head">
              <span className="eyebrow">FAQ</span>
              <h2 id="faq-title" className="section-title">
                Questions people ask
              </h2>
            </Reveal>
            <div className="faq">
              {FAQ.map((f, i) => (
                <Reveal key={f.q} delay={Math.min(i, 4) * 50}>
                  <details>
                    <summary>
                      {f.q}
                      <span className="plus" aria-hidden />
                    </summary>
                    <div className="answer">
                      <p>{f.a}</p>
                    </div>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="final container" aria-labelledby="final-title">
          <Reveal className="final-card">
            <h2 id="final-title" className="final-title">
              Find your schemes in
              <br /> the next two minutes
            </h2>
            <p className="final-sub">Free, private, and in the language you are most comfortable with.</p>
            <Cta dark />
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
