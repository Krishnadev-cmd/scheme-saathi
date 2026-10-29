import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { log } from "../log";

export interface Source {
  id: string;
  url: string;
  kind: "html" | "rss";
  note?: string;
}

/**
 * Official pages that announce schemes and application windows. Override or
 * extend by creating data/sources.json with the same shape.
 */
export const DEFAULT_SOURCES: Source[] = [
  { id: "nsp", url: "https://scholarships.gov.in", kind: "html", note: "National Scholarship Portal notices" },
  { id: "pm-internship", url: "https://pminternship.mca.gov.in", kind: "html", note: "PM Internship rounds" },
  { id: "myscheme", url: "https://www.myscheme.gov.in", kind: "html", note: "National scheme directory" },
  {
    id: "pib",
    url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    kind: "rss",
    note: "PIB press releases (new scheme launches)",
  },
  { id: "kerala-dce-scholarship", url: "https://dcescholarship.kerala.gov.in", kind: "html", note: "Kerala scholarships" },
  { id: "kerala-gov", url: "https://www.kerala.gov.in", kind: "html", note: "Kerala government announcements" },
];

export function loadSources(): Source[] {
  const fromEnv = process.env.PIPELINE_SOURCES?.trim();
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv) as Source[];
    } catch (err) {
      log.warn("Invalid PIPELINE_SOURCES JSON, using defaults", { err });
    }
  }
  const file = join(process.cwd(), "data", "sources.json");
  if (existsSync(file)) {
    try {
      return JSON.parse(readFileSync(file, "utf8")) as Source[];
    } catch (err) {
      log.warn("Invalid data/sources.json, using defaults", { err });
    }
  }
  return DEFAULT_SOURCES;
}

export async function fetchSource(src: Source): Promise<string> {
  const res = await fetch(src.url, {
    headers: { "User-Agent": "SchemeSaathiBot/0.1 (+public-benefit scheme alerts)", Accept: "text/html,application/xml" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  return src.kind === "rss" ? rssToText(body) : htmlToText(body, src.url);
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/** Plain text with links kept inline as "label (url)" so apply links survive. */
export function htmlToText(html: string, baseUrl: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
        let url = href;
        try {
          url = new URL(href, baseUrl).toString();
        } catch {}
        return ` ${label.replace(/<[^>]+>/g, " ").trim()} (${url}) `;
      })
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export function rssToText(xml: string): string {
  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const field = (item: string, tag: string) =>
    decode(
      (item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1] ?? "")
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/<[^>]+>/g, " ")
        .trim(),
    );
  return items
    .map((i) => `- ${field(i, "title")} (${field(i, "link")}) ${field(i, "pubDate")}\n  ${field(i, "description")}`)
    .join("\n");
}
