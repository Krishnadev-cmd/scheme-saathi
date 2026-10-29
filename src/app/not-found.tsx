import Link from "next/link";
import SiteNav from "@/components/SiteNav";

export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main id="main" className="prose" style={{ textAlign: "center" }}>
        <h1>This page is not here</h1>
        <p>The link may be old or mistyped. Your schemes are still one message away.</p>
        <p style={{ marginTop: "var(--s-400)", display: "flex", gap: "var(--s-300)", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/" className="btn btn-dark">
            Go to the homepage
          </Link>
          <Link href="/try" className="btn btn-ghost">
            Open the live demo
          </Link>
        </p>
      </main>
    </>
  );
}
