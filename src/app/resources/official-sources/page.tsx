import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { DEFAULT_SOURCES } from "@/lib/pipeline/sources";

export const metadata: Metadata = {
  title: "Official government scheme sources",
  description: "A directory of official Indian government portals used to verify Scheme Saathi information.",
  alternates: { canonical: "/resources/official-sources" },
};

export default function OfficialSourcesPage() {
  return (
    <>
      <SiteNav />
      <main id="main" className="prose">
        <p>
          <Link href="/">← Back to Scheme Saathi</Link>
        </p>
        <h1>Official government scheme sources</h1>
        <p>
          Scheme Saathi uses official government portals as its starting point for scheme information and application
          windows. Always confirm eligibility and deadlines on the source before applying.
        </p>
        <ul>
          {DEFAULT_SOURCES.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.note ?? source.id}
              </a>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
