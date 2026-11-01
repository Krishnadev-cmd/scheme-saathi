import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <div className="brand">Scheme Saathi</div>
          <p className="t-sm faint note" style={{ marginTop: "var(--s-75)" }}>
            An independent assistant. Always apply on the official government portal; eligibility shown is indicative.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul>
            <li>
              <Link href="/try">Live demo</Link>
            </li>
            <li>
              <Link href="/#faq">FAQ</Link>
            </li>
            <li>
              <Link href="/resources/official-sources">Official sources</Link>
            </li>
            <li>
              <Link href="/privacy">Privacy policy</Link>
            </li>
            <li>
              <Link href="/terms">Terms of use</Link>
            </li>
            <li>
              <Link href="/admin">Admin</Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
