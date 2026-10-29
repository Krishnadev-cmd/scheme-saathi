"use client";

import { ChatCircleDots, TelegramLogo } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PRIMARY } from "@/lib/links";

const ITEMS = [
  { href: "/#how", label: "How it works" },
  { href: "/#schemes", label: "Schemes" },
  { href: "/#privacy", label: "Privacy" },
  { href: "/#faq", label: "FAQ" },
  { href: "/try", label: "Live demo" },
];

export default function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="nav-shell">
        <nav className="nav" aria-label="Main">
          <Link href="/" className="brand" onClick={() => setOpen(false)}>
            <span className="brand-mark" aria-hidden>
              <ChatCircleDots size={18} weight="fill" />
            </span>
            Scheme Saathi
          </Link>
          <ul className="nav-links">
            {ITEMS.map((i) => (
              <li key={i.href}>
                <Link href={i.href} aria-current={pathname === i.href ? "page" : undefined}>
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
          <a className="btn btn-primary btn-sm nav-cta" href={PRIMARY.href}>
            {PRIMARY.isTelegram && <TelegramLogo size={16} weight="fill" aria-hidden />}
            {PRIMARY.label}
          </a>
          <button
            className="nav-toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <span />
            <span />
          </button>
        </nav>
      </div>
      <div id="mobile-menu" className="menu-overlay" data-open={open} aria-hidden={!open}>
        {ITEMS.map((i, n) => (
          <Link
            key={i.href}
            href={i.href}
            tabIndex={open ? 0 : -1}
            style={{ "--i": n } as React.CSSProperties}
            aria-current={pathname === i.href ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {i.label}
          </Link>
        ))}
        <a
          className="btn btn-primary"
          href={PRIMARY.href}
          tabIndex={open ? 0 : -1}
          style={{ "--i": ITEMS.length } as React.CSSProperties}
        >
          {PRIMARY.label}
        </a>
      </div>
    </>
  );
}
