"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { ADMIN_COOKIE, isAdmin, requireAdmin, sessionValue } from "@/lib/admin-auth";
import { deliverBroadcast, startBroadcast, type Audience } from "@/lib/broadcast";
import { getScheme, hitRateLimit, upsertScheme } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { notifyUsers } from "@/lib/pipeline/notify";
import { beginPipelineRun, executePipelineRun } from "@/lib/pipeline/run";
import { approve, reject } from "@/lib/review";
import { applySchemeEdit } from "@/lib/scheme-edit";
import { safeEqual } from "@/lib/security";

export async function login(formData: FormData) {
  const { adminToken, isProd } = env();
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  // Slow down token guessing: 10 attempts per IP per 15 minutes.
  if (!(await hitRateLimit(`login:${ip}`, 10, 15 * 60_000)).ok) redirect("/admin?error=2");
  const given = String(formData.get("token") ?? "");
  if (!adminToken || !safeEqual(given, adminToken)) {
    log.warn("admin login failed");
    redirect("/admin?error=1");
  }
  (await cookies()).set(ADMIN_COOKIE, sessionValue(adminToken), {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/admin",
    maxAge: 60 * 60 * 12,
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin");
}

export async function runNow(formData: FormData) {
  if (!(await isAdmin())) throw new Error("unauthorized");
  const runId = await beginPipelineRun();
  if (runId == null) redirect("/admin?busy=1");
  // Runs after the response; the page refreshes itself while the run is in progress.
  after(() =>
    executePipelineRun(runId, { force: formData.get("force") === "on" }).catch((err) =>
      log.warn("pipeline run failed (already reported)", { runId, err }),
    ),
  );
  revalidatePath("/admin");
  redirect("/admin");
}

export async function approveAction(formData: FormData) {
  if (!(await isAdmin())) throw new Error("unauthorized");
  const outcome = await approve(String(formData.get("id")));
  if (outcome) {
    log.info("review approved", { id: outcome.scheme.id, kind: outcome.kind });
    // Alert eligible users in the background; a new rolling scheme counts as newly discovered.
    const fresh = new Set(outcome.kind === "new" ? [outcome.scheme.id] : []);
    after(() =>
      notifyUsers([outcome.scheme], fresh).catch((err) => log.error("alerts after approval failed", { err })),
    );
  }
  revalidatePath("/admin");
}

export async function rejectAction(formData: FormData) {
  if (!(await isAdmin())) throw new Error("unauthorized");
  const outcome = await reject(String(formData.get("id")));
  if (outcome) log.info("review rejected", { id: outcome.scheme.id, kind: outcome.kind });
  revalidatePath("/admin");
}

export async function saveScheme(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const existing = await getScheme(id);
  if (!existing) redirect("/admin/schemes");
  const result = applySchemeEdit(existing, formData);
  if (!result.ok) redirect(`/admin/schemes/${encodeURIComponent(id)}?error=${encodeURIComponent(result.error)}`);
  await upsertScheme(result.scheme);
  log.info("scheme edited", { id });
  revalidatePath("/admin/schemes");
  redirect(`/admin/schemes/${encodeURIComponent(id)}?saved=1`);
}

export async function toggleHidden(formData: FormData) {
  await requireAdmin();
  const s = await getScheme(String(formData.get("id")));
  if (s) {
    await upsertScheme({ ...s, hidden: !s.hidden, editedAt: new Date().toISOString() });
    log.info(s.hidden ? "scheme shown" : "scheme hidden", { id: s.id });
  }
  revalidatePath("/admin/schemes");
}

export async function sendBroadcastAction(formData: FormData) {
  await requireAdmin();
  const en = String(formData.get("en") ?? "").trim();
  const hi = String(formData.get("hi") ?? "").trim() || undefined;
  const ml = String(formData.get("ml") ?? "").trim() || undefined;
  const audience: Audience = {
    channel: (["all", "telegram", "whatsapp"].includes(String(formData.get("channel"))) ? formData.get("channel") : "all") as Audience["channel"],
    lang: (["all", "en", "hi", "ml"].includes(String(formData.get("lang"))) ? formData.get("lang") : "all") as Audience["lang"],
  };
  if (!en) redirect("/admin/broadcast?error=" + encodeURIComponent("The English message is required."));
  if (en.length > 1000 || (hi?.length ?? 0) > 1000 || (ml?.length ?? 0) > 1000)
    redirect("/admin/broadcast?error=" + encodeURIComponent("Keep each message under 1,000 characters."));
  if (formData.get("confirm") !== "on")
    redirect("/admin/broadcast?error=" + encodeURIComponent("Tick the confirmation box to send."));

  const message = { en, hi, ml };
  const { id, users } = await startBroadcast(message, audience);
  log.info("broadcast started", { id, recipients: users.length, ...audience });
  after(() => deliverBroadcast(id, message, users));
  revalidatePath("/admin/broadcast");
  redirect(`/admin/broadcast?sent=${id}`);
}
