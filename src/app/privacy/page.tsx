import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "Read how Scheme Saathi collects, uses and deletes chat and eligibility information.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <>
      <SiteNav />
      <main id="main" className="prose">
        <h1>Privacy policy</h1>
        <p>
          Scheme Saathi is designed to collect as little as possible. This page explains what we keep and why. Replace
          this draft with your organisation&apos;s reviewed policy before launch.
        </p>
        <h2>What we store</h2>
        <ul>
          <li>Your chat ID on Telegram or WhatsApp, so we can reply and send alerts.</li>
          <li>Your answers: age, gender, state, area, occupation, income band, category and the yes or no questions.</li>
          <li>Your language choice, whether alerts are on, and which alerts we have already sent.</li>
          <li>When you agreed to this notice.</li>
        </ul>
        <h2>Your consent</h2>
        <p>
          Before asking any question, the bot shows a short notice explaining what it stores and why, and asks whether
          you agree. If you choose “No, thanks”, nothing about you is kept. Consent is asked for under India&apos;s
          Digital Personal Data Protection Act, 2023.
        </p>
        <h2>What we never collect</h2>
        <p>
          We never ask for Aadhaar, PAN, bank account, card, passport or other identity numbers. If one is sent by
          mistake, the bot refuses it and does not save that message.
        </p>
        <h2>How we use it</h2>
        <p>
          Only to match you with schemes and notify you about application windows. If AI assistance is turned on,
          your message text and answers are sent to our AI provider to understand replies; they are not used to
          identify you.
        </p>
        <h2>Your choices</h2>
        <p>
          Send “alerts off” to stop notifications or “restart” to answer the questions again. Send{" "}
          <b>/delete</b> at any time to erase everything we hold about you: your answers, language, alert settings and
          alert history. The bot asks you to confirm, then deletes it straight away. Administrators only see anonymous
          totals and exports in which your chat ID is replaced by a one way code.
        </p>
        <p>
          <Link href="/" className="link-arrow">
            ← Back to home
          </Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
