import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

export const metadata: Metadata = { title: "Terms of use" };

export default function Terms() {
  return (
    <>
      <SiteNav />
      <main id="main" className="prose">
        <h1>Terms of use</h1>
        <p>Replace this draft with terms reviewed by your organisation before launch.</p>
        <h2>Not a government service</h2>
        <p>
          Scheme Saathi is an independent information service. It is not run by, or affiliated with, any government
          department.
        </p>
        <h2>Information only</h2>
        <p>
          Eligibility results are indicative and based on published rules, which change. The responsible department
          makes the final decision. Always confirm details and apply on the official portal.
        </p>
        <h2>Fair use</h2>
        <p>Do not use the service to send spam, abuse or other people&apos;s personal data.</p>
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
