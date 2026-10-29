import { ArrowLeft, FloppyDisk } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getScheme } from "@/lib/db";
import { describeRules } from "@/lib/review";
import type { Localized } from "@/lib/types";
import { saveScheme } from "../../actions";
import { TopBar } from "../../AdminChrome";
import "../../admin.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit scheme · Admin", robots: { index: false } };

function LangFields({ name, label, value, rows = 2 }: { name: string; label: string; value: Localized; rows?: number }) {
  return (
    <fieldset className="lang-fields">
      <legend>{label}</legend>
      <label>
        <span>English (required)</span>
        <textarea name={`${name}En`} defaultValue={value.en} rows={rows} required />
      </label>
      <label>
        <span lang="hi">हिन्दी</span>
        <textarea name={`${name}Hi`} defaultValue={value.hi ?? ""} rows={rows} lang="hi" />
      </label>
      <label>
        <span lang="ml">മലയാളം</span>
        <textarea name={`${name}Ml`} defaultValue={value.ml ?? ""} rows={rows} lang="ml" />
      </label>
    </fieldset>
  );
}

export default async function EditScheme({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { error, saved } = await searchParams;
  const s = await getScheme(decodeURIComponent(id));
  if (!s) notFound();

  return (
    <>
      <TopBar signedIn active="schemes" />
      <main id="main" className="container admin">
        <Link href="/admin/schemes" className="link-arrow">
          <ArrowLeft size={16} aria-hidden /> All schemes
        </Link>
        <h1 className="admin-title">{s.name.en}</h1>
        {saved && (
          <p className="notice" role="status">
            Saved. Users see the new text from their next message.
          </p>
        )}
        {error && (
          <p className="login-error" role="alert">
            Not saved: {error}
          </p>
        )}

        <form action={saveScheme} className="admin-card edit-form">
          <input type="hidden" name="id" value={s.id} />
          <LangFields name="name" label="Name" value={s.name} rows={1} />
          <LangFields name="summary" label="Summary" value={s.summary} />
          <LangFields name="benefits" label="Benefits" value={s.benefits} />
          <LangFields name="how" label="How to apply" value={s.howToApply} />

          <div className="field-grid">
            <label>
              <span>Ministry / department</span>
              <input name="ministry" defaultValue={s.ministry} required />
            </label>
            <label>
              <span>Level</span>
              <select name="level" defaultValue={s.level}>
                <option value="central">Central</option>
                <option value="state">State</option>
              </select>
            </label>
            <label className="wide">
              <span>Official apply link (https)</span>
              <input name="applyUrl" type="url" defaultValue={s.applyUrl} required />
            </label>
            <label>
              <span>Applications open (optional)</span>
              <input name="openDate" type="date" defaultValue={s.openDate ?? ""} />
            </label>
            <label>
              <span>Applications close (optional)</span>
              <input name="closeDate" type="date" defaultValue={s.closeDate ?? ""} />
            </label>
            <label className="wide">
              <span>Documents (one per line)</span>
              <textarea name="documents" rows={3} defaultValue={s.documents.join("\n")} />
            </label>
            <label className="wide">
              <span>Eligibility rules (JSON)</span>
              <textarea name="rules" rows={6} className="mono" defaultValue={JSON.stringify(s.rules, null, 2)} />
              <small className="faint">
                Currently: {describeRules(s.rules).join(" · ")}. Keys: minAge, maxAge, genders, occupations, categories,
                maxIncome, states, area, requiresDisability, requiresBpl, requiresLand, requiresGirlChildUnder10, anyOf.
              </small>
            </label>
          </div>

          <div className="review-actions">
            <button className="btn btn-primary">
              <FloppyDisk size={18} aria-hidden /> Save changes
            </button>
            <Link href="/admin/schemes" className="btn btn-ghost">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </>
  );
}
