import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Sans_Devanagari, Noto_Sans_Malayalam } from "next/font/google";
import { env } from "@/lib/env";
import "./globals.css";

// Manrope is the only design typeface; the Noto faces only supply Hindi and Malayalam glyphs.
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-manrope" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "600", "700"], variable: "--font-deva" });
const mlym = Noto_Sans_Malayalam({ subsets: ["malayalam"], weight: ["400", "600", "700"], variable: "--font-mlym" });

const description =
  "Answer a few simple questions on Telegram or WhatsApp and find the government schemes you can apply for, in English, Hindi or Malayalam.";

export const metadata: Metadata = {
  metadataBase: new URL(env().baseUrl),
  applicationName: "Scheme Saathi",
  authors: [{ name: "Scheme Saathi" }],
  creator: "Scheme Saathi",
  publisher: "Scheme Saathi",
  title: { default: "Scheme Saathi · Find the government schemes you can claim", template: "%s · Scheme Saathi" },
  description,
  keywords: [
    "government schemes India",
    "government benefits",
    "scheme eligibility",
    "Indian welfare schemes",
    "सरकारी योजनाएं",
    "സർക്കാർ പദ്ധതികൾ",
  ],
  openGraph: { title: "Scheme Saathi", description, type: "website", locale: "en_IN", siteName: "Scheme Saathi" },
  twitter: { card: "summary_large_image", title: "Scheme Saathi", description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#2aabee" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${deva.variable} ${mlym.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
