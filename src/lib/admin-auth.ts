import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "./env";
import { safeEqual } from "./security";

export const ADMIN_COOKIE = "saathi_admin";

/** The cookie holds a digest of the admin token, never the token itself. */
export function sessionValue(token: string) {
  return createHmac("sha256", token).update("scheme-saathi-admin-session").digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  const { adminToken, isProd } = env();
  if (!adminToken) return !isProd; // open only in development
  const jar = await cookies();
  return safeEqual(jar.get(ADMIN_COOKIE)?.value, sessionValue(adminToken));
}

/** For admin sub-pages and actions: sends signed-out visitors to the login screen. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin");
}
