import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import AutoRefresh from "@/components/AutoRefresh";
import { requireAdmin } from "@/lib/admin-auth";
import { audienceUsers } from "@/lib/broadcast";
import { listBroadcasts } from "@/lib/db";
import { env } from "@/lib/env";
import { sendBroadcastAction } from "../actions";
import { TopBar } from "../AdminChrome";
import "../admin.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Server actions on this page start background work (pipeline run / broadcast) with after().
export const maxDuration = 300;
export const metadata: Metadata = { title: "Broadcast · Admin", robots: { index: false } };

export default async function BroadcastAdmin({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  await requireAdmin();
  const { error, sent } = await searchParams;
  const history = await listBroadcasts();
  const sending = history.some((b) => b.status === "sending");
  const all = await audienceUsers({ channel: "all", lang: "all" });
  const count = (f: (u: (typeof all)[number]) => boolean) => all.filter(f).length;

  return (
    <>
      <TopBar signedIn active="broadcast" />
      <AutoRefresh active={sending} />
      <main id="main" className="container admin">
        <h1 className="admin-title">Broadcast</h1>
        {sent && (
          <p className="notice" role="status">
            Broadcast #{sent} is being sent. Progress updates below.
          </p>
        )}
        {error && (
          <p className="login-error" role="alert">
            Not sent: {error}
          </p>
        )}

        <form action={sendBroadcastAction} className="admin-card edit-form">
          <p className="t-sm muted">
            Goes to users who gave consent and have alerts on: <b>{all.length}</b> right now (Telegram{" "}
            {count((u) => u.channel === "telegram")}, WhatsApp {count((u) => u.channel === "whatsapp")}). Each person
            gets the text in their language, or English if that language is empty.
            {env().whatsapp.enabled &&
              (env().whatsapp.notifyTemplate
                ? " WhatsApp users inactive for over 24 hours receive it through your approved template."
                : " WhatsApp users inactive for over 24 hours are skipped, because no template is configured.")}
          </p>
          <fieldset className="lang-fields">
            <legend>Message</legend>
            <label>
              <span>English (required)</span>
              <textarea name="en" rows={4} maxLength={1000} required />
            </label>
            <label>
              <span lang="hi">हिन्दी</span>
              <textarea name="hi" rows={4} maxLength={1000} lang="hi" />
            </label>
            <label>
              <span lang="ml">മലയാളം</span>
              <textarea name="ml" rows={4} maxLength={1000} lang="ml" />
            </label>
          </fieldset>
          <div className="field-grid">
            <label>
              <span>Channel</span>
              <select name="channel" defaultValue="all">
                <option value="all">All channels</option>
                <option value="telegram">Telegram only</option>
                <option value="whatsapp">WhatsApp only</option>
              </select>
            </label>
            <label>
              <span>Language</span>
              <select name="lang" defaultValue="all">
                <option value="all">Everyone</option>
                <option value="en">English speakers</option>
                <option value="hi">Hindi speakers</option>
                <option value="ml">Malayalam speakers</option>
              </select>
            </label>
          </div>
          <label className="confirm">
            <input type="checkbox" name="confirm" required /> I have checked the text, and want to message these users now.
          </label>
          <div className="review-actions">
            <button className="btn btn-primary">
              <PaperPlaneTilt size={18} weight="fill" aria-hidden /> Send broadcast
            </button>
          </div>
        </form>

        <section className="admin-card" aria-labelledby="history-title">
          <h2 id="history-title">History</h2>
          {history.length === 0 ? (
            <p className="empty">No broadcasts yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Message</th>
                    <th scope="col">Audience</th>
                    <th scope="col">Delivered</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((b) => (
                    <tr key={b.id}>
                      <td>{b.id}</td>
                      <td>
                        {b.message.en.slice(0, 120)}
                        {b.message.en.length > 120 && "…"}
                        <div className="t-xs faint">{new Date(b.createdAt).toLocaleString("en-IN")}</div>
                      </td>
                      <td className="cap">
                        {b.audience.channel} · {b.audience.lang}
                      </td>
                      <td>
                        {b.sent} of {b.total}
                        {b.skipped > 0 && <div className="t-xs faint">{b.skipped} skipped</div>}
                      </td>
                      <td>
                        <span className={`tag ${b.status === "done" ? "ok" : b.status === "sending" ? "running" : "error"}`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
