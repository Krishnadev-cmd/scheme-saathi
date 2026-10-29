import { DownloadSimple, Eye, EyeSlash, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listSchemes } from "@/lib/db";
import { windowStatus } from "@/lib/eligibility";
import { toggleHidden } from "../actions";
import { TopBar } from "../AdminChrome";
import "../admin.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Schemes · Admin", robots: { index: false } };

export default async function SchemesAdmin() {
  await requireAdmin();
  const schemes = (await listSchemes()).sort((a, b) => a.name.en.localeCompare(b.name.en));

  return (
    <>
      <TopBar signedIn active="schemes" />
      <main id="main" className="container admin">
        <div className="admin-card-head">
          <h1 className="admin-title">Schemes</h1>
          <div className="export-links">
            <a className="btn btn-ghost btn-sm" href="/admin/export/schemes.csv">
              <DownloadSimple size={16} weight="bold" aria-hidden /> Schemes CSV
            </a>
            <a className="btn btn-ghost btn-sm" href="/admin/export/fact-check.csv">
              <DownloadSimple size={16} weight="bold" aria-hidden /> Fact check sheet
            </a>
            <a className="btn btn-ghost btn-sm" href="/admin/export/translations.csv">
              <DownloadSimple size={16} weight="bold" aria-hidden /> Translation review sheet
            </a>
          </div>
        </div>
        <section className="admin-card">
          <p className="t-sm muted">
            Edits are saved straight away and survive <code>npm run seed</code>. Hidden schemes stay in the database but
            are never shown to users or alerted.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Scheme</th>
                  <th scope="col">Window</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {schemes.map((s) => {
                  const status = s.hidden
                    ? "hidden"
                    : s.review === "pending"
                      ? "pending review"
                      : s.review === "rejected"
                        ? "rejected"
                        : "live";
                  return (
                    <tr key={s.id} className={s.hidden ? "muted-row" : undefined}>
                      <td>
                        <Link href={`/admin/schemes/${encodeURIComponent(s.id)}`}>{s.name.en}</Link>
                        <div className="t-xs faint">
                          {s.ministry} · {s.source}
                          {s.editedAt && ` · edited ${new Date(s.editedAt).toLocaleDateString("en-IN")}`}
                        </div>
                      </td>
                      <td>
                        <span className={`tag ${windowStatus(s)}`}>{windowStatus(s)}</span>
                        {(s.openDate || s.closeDate) && (
                          <div className="t-xs faint">
                            {s.openDate ?? "…"} → {s.closeDate ?? "…"}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`tag ${status === "live" ? "ok" : status === "pending review" ? "upcoming" : "closed"}`}>
                          {status}
                        </span>
                      </td>
                      <td className="row-actions">
                        <Link className="btn btn-ghost btn-sm" href={`/admin/schemes/${encodeURIComponent(s.id)}`}>
                          <PencilSimple size={16} aria-hidden /> Edit
                        </Link>
                        {s.review !== "pending" && s.review !== "rejected" && (
                          <form action={toggleHidden}>
                            <input type="hidden" name="id" value={s.id} />
                            <button className="btn btn-ghost btn-sm">
                              {s.hidden ? <Eye size={16} aria-hidden /> : <EyeSlash size={16} aria-hidden />}
                              {s.hidden ? "Show" : "Hide"}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
