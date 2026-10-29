import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { funnel } from "@/lib/insights";
import { TopBar } from "../AdminChrome";
import "../admin.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Insights · Admin", robots: { index: false } };

const LANG: Record<string, string> = { en: "English", hi: "Hindi", ml: "Malayalam" };
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "0%");

export default async function Insights() {
  await requireAdmin();
  const f = await funnel();
  const top = f.rows[0]?.reached || 1;

  return (
    <>
      <TopBar signedIn active="insights" />
      <main id="main" className="container admin">
        <div className="admin-card-head">
          <h1 className="admin-title">Insights</h1>
          <a className="btn btn-ghost btn-sm" href="/admin/export/users.csv">
            <DownloadSimple size={16} weight="bold" aria-hidden /> Users CSV (anonymised)
          </a>
        </div>

        <div className="admin-stats">
          <div className="admin-card stat">
            <b>{f.total}</b>
            <span className="t-sm muted">people on Telegram and WhatsApp</span>
          </div>
          <div className="admin-card stat">
            <b>{pct(f.rows.at(-1)?.reached ?? 0, f.total)}</b>
            <span className="t-sm muted">finished the questions</span>
          </div>
          <div className="admin-card stat">
            <b>{f.alertsOn}</b>
            <span className="t-sm muted">finished and have alerts on</span>
          </div>
          <div className="admin-card stat">
            <b>{f.consentDeclined}</b>
            <span className="t-sm muted">declined consent · {f.dataDeleted} deleted their data</span>
          </div>
        </div>

        <section className="admin-card" aria-labelledby="funnel-title">
          <h2 id="funnel-title">Where people drop off</h2>
          <p className="t-sm muted">
            Each bar is how many people reached that question. <b>Stalled</b> means they are on that question and have
            not replied for over 24 hours, which is where the conversation is losing people.
            {f.worstStep && (
              <>
                {" "}
                The biggest drop off is at <b>{f.rows.find((r) => r.step === f.worstStep)?.label}</b>.
              </>
            )}
          </p>
          {f.total === 0 ? (
            <p className="empty">No users yet. The funnel fills in once people start chatting with the bot.</p>
          ) : (
            <ol className="funnel">
              {f.rows.map((r) => (
                <li key={r.step} className={r.step === f.worstStep ? "worst" : undefined}>
                  <span className="funnel-label">{r.label}</span>
                  <span className="funnel-bar" aria-hidden>
                    <span style={{ width: `${(r.reached / top) * 100}%` }} />
                  </span>
                  <span className="funnel-num">
                    {r.reached} <span className="faint">({pct(r.reached, f.total)})</span>
                  </span>
                  <span className="funnel-stall t-xs">
                    {r.step === "done" ? `${r.inProgress} done` : `${r.stalled} stalled · ${r.inProgress} active`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="admin-stats">
          <section className="admin-card">
            <h2>Languages</h2>
            <ul className="plain-list">
              {Object.entries(f.byLanguage).map(([k, v]) => (
                <li key={k}>
                  {LANG[k] ?? k}: <b>{v}</b> ({pct(v, f.total)})
                </li>
              ))}
            </ul>
          </section>
          <section className="admin-card">
            <h2>Channels</h2>
            <ul className="plain-list">
              {Object.entries(f.byChannel).map(([k, v]) => (
                <li key={k} className="cap">
                  {k}: <b>{v}</b> ({pct(v, f.total)})
                </li>
              ))}
            </ul>
          </section>
        </div>
        <p className="t-xs faint">
          Web demo sessions are excluded. The users CSV replaces chat ids with a one way code and contains no names or
          numbers.
        </p>
      </main>
    </>
  );
}
