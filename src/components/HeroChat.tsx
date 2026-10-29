"use client";

import { ArrowCounterClockwise, Checks, ShieldCheck } from "@phosphor-icons/react";
import { Fragment, useEffect, useRef, useState } from "react";

type Line = { from: "bot" | "me"; text: string; chips?: string[] };
type Lang = "en" | "hi" | "ml";

const SCRIPTS: Record<Lang, Line[]> = {
  en: [
    { from: "me", text: "Hi" },
    { from: "bot", text: "Namaste! I'm Scheme Saathi. What is your age?" },
    { from: "me", text: "34" },
    { from: "bot", text: "What best describes your work?", chips: ["Farmer", "Student", "Own business"] },
    { from: "me", text: "Farmer" },
    {
      from: "bot",
      text: "You may be eligible for 6 schemes:\n1. PM-KISAN · ₹6,000 a year\n2. PM Kisan Maandhan · ₹3,000 monthly pension\n3. PM Suraksha Bima · ₹2 lakh cover for ₹20",
    },
  ],
  hi: [
    { from: "me", text: "नमस्ते" },
    { from: "bot", text: "नमस्ते! मैं स्कीम साथी हूँ। आपकी उम्र कितनी है?" },
    { from: "me", text: "34" },
    { from: "bot", text: "आपका काम क्या है?", chips: ["किसान", "छात्र / छात्रा", "स्वरोज़गार"] },
    { from: "me", text: "किसान" },
    {
      from: "bot",
      text: "आप 6 योजनाओं के लिए पात्र हो सकते हैं:\n1. पीएम-किसान · ₹6,000 प्रति वर्ष\n2. पीएम किसान मानधन · ₹3,000 मासिक पेंशन\n3. पीएम सुरक्षा बीमा · ₹20 में ₹2 लाख कवर",
    },
  ],
  ml: [
    { from: "me", text: "ഹലോ" },
    { from: "bot", text: "നമസ്കാരം! ഞാൻ സ്കീം സാഥി. നിങ്ങളുടെ പ്രായം എത്ര?" },
    { from: "me", text: "34" },
    { from: "bot", text: "നിങ്ങളുടെ തൊഴിൽ ഏതാണ്?", chips: ["കർഷകൻ", "വിദ്യാർത്ഥി", "സ്വയംതൊഴിൽ"] },
    { from: "me", text: "കർഷകൻ" },
    {
      from: "bot",
      text: "6 പദ്ധതികൾക്ക് നിങ്ങൾ യോഗ്യരായേക്കാം:\n1. പിഎം-കിസാൻ · വർഷം ₹6,000\n2. പിഎം കിസാൻ മാൻധൻ · മാസം ₹3,000 പെൻഷൻ\n3. പിഎം സുരക്ഷാ ബീമ · ₹20-ന് ₹2 ലക്ഷം",
    },
  ],
};

const LANG_TABS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी" },
  { id: "ml", label: "മലയാളം" },
];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A scripted conversation that plays once when it scrolls into view. */
export default function HeroChat() {
  const [lang, setLang] = useState<Lang>("en");
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const [run, setRun] = useState(0);
  const [inView, setInView] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const script = SCRIPTS[lang];

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setInView(true), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setShown(script.length);
      return;
    }
    setShown(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 500;
    script.forEach((line, i) => {
      if (line.from === "bot") {
        timers.push(setTimeout(() => setTyping(true), t));
        t += 900;
      }
      timers.push(
        setTimeout(() => {
          setTyping(false);
          setShown(i + 1);
        }, t),
      );
      t += line.from === "me" ? 700 : 1100;
    });
    return () => timers.forEach(clearTimeout);
  }, [inView, lang, run, script]);

  const done = shown >= script.length;

  return (
    <div className="hero-phone" ref={root}>
      <div className="lang-tabs" role="tablist" aria-label="Demo language">
        {LANG_TABS.map((l) => (
          <button
            key={l.id}
            role="tab"
            aria-selected={lang === l.id}
            onClick={() => {
              setLang(l.id);
              setRun((r) => r + 1);
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="phone-frame" aria-label="Example conversation with Scheme Saathi">
        <div className="chat-header">
          <span className="chat-avatar" aria-hidden>
            SS
          </span>
          <div>
            <div className="chat-title">Scheme Saathi</div>
            <div className="chat-sub">{typing ? "typing…" : "bot"}</div>
          </div>
        </div>
        <div className="chat-body">
          <div className="chat-pill">
            <ShieldCheck size={14} weight="fill" aria-hidden /> Never asks for Aadhaar, PAN or bank numbers
          </div>
          {script.slice(0, shown).map((l, i) => (
            <Fragment key={`${lang}-${run}-${i}`}>
              <div className={`chat-msg ${l.from}`}>
                <span>{l.text}</span>
                <span className="chat-meta" aria-hidden>
                  9:4{i}
                  {l.from === "me" && <Checks size={14} weight="bold" className="chat-ticks" />}
                </span>
              </div>
              {l.chips && (
                // Telegram shows bot buttons as an inline keyboard under the message.
                <div className="chat-keyboard" aria-hidden>
                  {l.chips.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
              )}
            </Fragment>
          ))}
          {typing && (
            <div className="chat-msg bot chat-typing" aria-hidden>
              <i />
              <i />
              <i />
            </div>
          )}
        </div>
      </div>

      <button
        className="replay"
        onClick={() => setRun((r) => r + 1)}
        style={{ visibility: done ? "visible" : "hidden" }}
      >
        <ArrowCounterClockwise size={16} weight="bold" aria-hidden /> Replay
      </button>
    </div>
  );
}
