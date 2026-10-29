import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { env } from "@/lib/env";
import { logout } from "./actions";

const TABS = [
  { href: "/admin", label: "Dashboard", key: "dashboard" },
  { href: "/admin/schemes", label: "Schemes", key: "schemes" },
  { href: "/admin/broadcast", label: "Broadcast", key: "broadcast" },
  { href: "/admin/insights", label: "Insights", key: "insights" },
] as const;

export type AdminTab = (typeof TABS)[number]["key"];

export function TopBar({ signedIn = false, active }: { signedIn?: boolean; active?: AdminTab }) {
  return (
    <header className="admin-bar">
      <div className="container admin-bar-inner">
        <Link href="/" className="admin-back">
          <ArrowLeft size={16} weight="bold" aria-hidden /> Scheme Saathi
        </Link>
        {signedIn && (
          <nav className="admin-tabs" aria-label="Admin">
            {TABS.map((t) => (
              <Link key={t.key} href={t.href} aria-current={active === t.key ? "page" : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="admin-bar-right">
          <span className="admin-badge">{env().appEnv === "production" ? "Production" : "Development"}</span>
          {signedIn && env().adminToken && (
            <form action={logout}>
              <button className="admin-logout">Sign out</button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
