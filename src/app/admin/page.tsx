import {
  ArrowSquareOut,
  BellRinging,
  Broadcast,
  Check,
  ClipboardText,
  ListBullets,
  LockKey,
  Play,
  UsersThree,
  X,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import { isAdmin } from "@/lib/admin-auth";
import { countNotifications, listPipelineRuns, listSchemes, listUsers } from "@/lib/db";
import { isLive, windowStatus } from "@/lib/eligibility";
import { llmEnabled } from "@/lib/llm";
import { loadSources } from "@/lib/pipeline/sources";
import { describeRules, listReviewQueue } from "@/lib/review";
import type { Scheme } from "@/lib/types";
import { approveAction, login, rejectAction, runNow } from "./actions";
import { TopBar } from "./AdminChrome";
import "./admin.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Server actions on this page start background work (pipeline run / broadcast) with after().
export const maxDuration = 300;
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const fmtWindow = (w: { openDate?: string; closeDate?: string }) =>
  !w.openDate && !w.closeDate ? "Always open (rolling)" : `${w.openDate ?? "now"} → ${w.closeDate ?? "no end date"}`;

function ReviewButtons({ id, approveLabel }: { id: string; approveLabel: string }) {
  return (
    <div className="review-actions">
      <form action={approveAction}>
        <input type="hidden" name="id" value={id} />
        <button className="btn btn-primary btn-sm">
          <Check size={16} weight="bold" aria-hidden /> {approveLabel}
        </button>
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="id" value={id} />
        <button className="btn btn-ghost btn-sm">
          <X size={16} weight="bold" aria-hidden /> Reject
        </button>
      </form>
    </div>
  );
}

function NewSchemeCard({ s }: { s: Scheme }) {
  return (
    <li className="review-item">
      <div className="review-head">
        <span className="tag upcoming">New scheme</span>
        <span className="t-xs faint">
          {s.level === "central" ? "Central" : "State"} · {s.ministry}
        </span>
      </div>
      <h3>{s.name.en}</h3>
      <p className="t-xs faint">
        {s.name.hi} · {s.name.ml}
      </p>
      <p className="t-sm">{s.summary.en}</p>
      <dl className="review-facts">
        <div>
          <dt>Benefits</dt>
          <dd>{s.benefits.en}</dd>
        </div>
        <div>
          <dt>Who qualifies</dt>
          <dd>{describeRules(s.rules).join(" · ")}</dd>
        </div>
        <div>
          <dt>Window</dt>
          <dd>{fmtWindow(s)}</dd>
        </div>
        {s.documents.length > 0 && (
          <div>
            <dt>Documents</dt>
            <dd>{s.documents.join(", ")}</dd>
          </div>
        )}
      </dl>
      <div className="review-links t-sm">
        <a href={s.applyUrl} target="_blank" rel="noreferrer">
          Apply link <ArrowSquareOut size={14} aria-hidden />
        </a>
        {s.sourceUrl && (
          <a href={s.sourceUrl} target="_blank" rel="noreferrer">
            Where it was found <ArrowSquareOut size={14} aria-hidden />
          </a>
        )}
      </div>
      <ReviewButtons id={s.id} approveLabel="Approve and publish" />
    </li>
  );
}

function WindowChangeCard({ s }: { s: Scheme }) {
  const w = s.pendingWindow!;
  return (
    <li className="review-item">
      <div className="review-head">
        <span className="tag running">Deadline change</span>
        <span className="t-xs faint">Found {new Date(w.foundAt).toLocaleString("en-IN")}</span>
      </div>
      <h3>{s.name.en}</h3>
      <dl className="review-facts">
        <div>
          <dt>Now</dt>
          <dd>{fmtWindow(s)}</dd>
        </div>
        <div>
          <dt>Proposed</dt>
          <dd>
            <b>{fmtWindow(w)}</b>
          </dd>
        </div>
      </dl>
      <div className="review-links t-sm">
        <a href={w.sourceUrl} target="_blank" rel="noreferrer">
          Check the source page <ArrowSquareOut size={14} aria-hidden />
        </a>
      </div>
      <ReviewButtons id={s.id} approveLabel="Approve change" />
    </li>
  );
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ error?: string; busy?: string }> }) {
  const { error, busy } = await searchParams;
  if (!(await isAdmin())) {
    return (
      <>
        <TopBar />
        <main id="main" className="container admin-locked">
          <span className="icon-tile">
            <LockKey size={24} weight="duotone" aria-hidden />
          </span>
          <h1>Sign in to the dashboard</h1>
          <p className="muted">Enter the ADMIN_TOKEN configured on the server.</p>
          <form action={login} className="login-form">
            <label htmlFor="token" className="t-sm">
              Admin token
            </label>
            <input id="token" name="token" type="password" required autoComplete="current-password" />
            {error && (
              <p className="login-error" role="alert">
                {error === "2" ? "Too many attempts. Try again in 15 minutes." : "That token is not correct."}
              </p>
            )}
            <button className="btn btn-dark">Sign in</button>
          </form>
        </main>
      </>
    );
  }

  const schemes = await listSchemes();
  const users = await listUsers();
  const runs = await listPipelineRuns(5);
  const byChannel = (c: string) => users.filter((u) => u.channel === c).length;
  const live = schemes.filter(isLive);
  const discovered = live.filter((s) => s.source === "pipeline").length;
  const openCount = live.filter((s) => windowStatus(s) === "open").length;
  const queue = await listReviewQueue();
  const pending = queue.newSchemes.length + queue.windowChanges.length;
  const running = runs.some((r) => r.status === "running");

  const stats = [
    { icon: ClipboardText, value: pending, label: "waiting for your review" },
    { icon: ListBullets, value: live.length, label: `live schemes · ${discovered} found by the pipeline` },
    { icon: Broadcast, value: openCount, label: "with an open application window" },
    {
      icon: UsersThree,
      value: users.length,
      label: `users · Telegram ${byChannel("telegram")} · WhatsApp ${byChannel("whatsapp")} · web ${byChannel("web")}`,
    },
    { icon: BellRinging, value: await countNotifications(), label: "alerts sent" },
  ];

  return (
    <>
      <TopBar signedIn active="dashboard" />
      <AutoRefresh active={running} />
      <main id="main" className="container admin">
        <h1 className="admin-title">Dashboard</h1>

        <div className="admin-stats">
          {stats.map((s) => (
            <div key={s.label} className="admin-card stat">
              <span className="icon-tile">
                <s.icon size={22} weight="duotone" aria-hidden />
              </span>
              <b>{s.value}</b>
              <span className="t-sm muted">{s.label}</span>
            </div>
          ))}
        </div>

        <section className="admin-card" aria-labelledby="review-title">
          <h2 id="review-title">Review queue</h2>
          <p className="t-sm muted">
            Schemes and deadlines found by the pipeline stay hidden from users until you approve them. Approving
            publishes the item and alerts eligible users.
          </p>
          {pending === 0 ? (
            <p className="empty">Nothing to review. New findings from the pipeline will appear here.</p>
          ) : (
            <ul className="review-list">
              {queue.newSchemes.map((s) => (
                <NewSchemeCard key={s.id} s={s} />
              ))}
              {queue.windowChanges.map((s) => (
                <WindowChangeCard key={s.id} s={s} />
              ))}
            </ul>
          )}
        </section>

        <section className="admin-card" aria-labelledby="pipeline-title">
          <div className="admin-card-head">
            <div>
              <h2 id="pipeline-title">Discovery pipeline</h2>
              <p className="t-sm muted">
                {llmEnabled() ? "Groq extraction is on." : "Heuristic mode. Set GROQ_API_KEY to turn on AI extraction."}{" "}
                Sources: {loadSources().map((s) => s.id).join(", ")}
              </p>
            </div>
            <form action={runNow} className="run-form">
              <label className="t-sm">
                <input type="checkbox" name="force" /> Re-read unchanged pages
              </label>
              <button className="btn btn-dark btn-sm" disabled={running}>
                <Play size={16} weight="fill" aria-hidden /> {running ? "Running…" : "Run now"}
              </button>
            </form>
          </div>
          {busy && !running && <p className="notice">A run was already in progress, so a new one was not started.</p>}
          {running && <p className="notice">A run is in progress. This page updates every few seconds.</p>}
          {runs.length === 0 ? (
            <p className="empty">No runs yet. Start one with Run now, or schedule a daily call to /api/pipeline/run.</p>
          ) : (
            runs.map((r) => (
              <details key={r.id} open={r.id === runs[0]?.id} className="run">
                <summary>
                  <span>Run #{r.id}</span>
                  <span className="t-sm muted">{new Date(r.startedAt).toLocaleString("en-IN")}</span>
                  <span className={`tag ${r.status}`}>{r.status}</span>
                </summary>
                <pre className="log">{r.log || "…"}</pre>
              </details>
            ))
          )}
        </section>

        <p className="t-sm muted">
          Edit or hide schemes on the <Link href="/admin/schemes">Schemes</Link> tab. Broadcasts, the drop off funnel and
          CSV exports are under <Link href="/admin/broadcast">Broadcast</Link> and{" "}
          <Link href="/admin/insights">Insights</Link>.
        </p>
      </main>
    </>
  );
}
