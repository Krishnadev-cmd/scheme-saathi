import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { env } from "@/lib/env";
import { describeRules } from "@/lib/review";
import { seedSchemes } from "@/lib/schemes/seed";

type Props = { params: Promise<{ id: string }> };

const schemes = seedSchemes();

export function generateStaticParams() {
  return schemes.map((scheme) => ({ id: scheme.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const scheme = schemes.find((item) => item.id === id);
  if (!scheme) return {};

  const description = `${scheme.summary.en} ${scheme.benefits.en} Check eligibility, documents and the official application link.`;
  return {
    title: scheme.name.en,
    description,
    alternates: { canonical: `/schemes/${scheme.id}` },
    openGraph: { title: scheme.name.en, description, type: "article" },
  };
}

export default async function SchemePage({ params }: Props) {
  const { id } = await params;
  const scheme = schemes.find((item) => item.id === id);
  if (!scheme) notFound();

  const baseUrl = env().baseUrl;
  const description = `${scheme.summary.en} ${scheme.benefits.en}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: scheme.name.en,
    description,
    dateModified: scheme.updatedAt,
    author: { "@type": "Organization", name: "Scheme Saathi" },
    publisher: { "@type": "Organization", name: "Scheme Saathi" },
    mainEntityOfPage: `${baseUrl}/schemes/${scheme.id}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteNav />
      <main id="main" className="prose">
        <p>
          <Link href="/">← All schemes</Link>
        </p>
        <span className="eyebrow">{scheme.level === "central" ? "Central scheme" : "Kerala scheme"}</span>
        <h1>{scheme.name.en}</h1>
        <p>{scheme.summary.en}</p>
        <h2>Benefits</h2>
        <p>{scheme.benefits.en}</p>
        <h2>Who may be eligible</h2>
        <ul>
          {describeRules(scheme.rules).map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <h2>Documents commonly needed</h2>
        <ul>
          {scheme.documents.map((document) => (
            <li key={document}>{document}</li>
          ))}
        </ul>
        <h2>How to apply</h2>
        <p>{scheme.howToApply.en}</p>
        <p>
          <a className="btn btn-primary" href={scheme.applyUrl} target="_blank" rel="noreferrer">
            Apply on the official portal →
          </a>
        </p>
        <p className="muted">
          Eligibility and scheme rules can change. Confirm the latest details on the official portal before applying.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
