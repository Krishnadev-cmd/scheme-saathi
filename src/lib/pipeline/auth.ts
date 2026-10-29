import { env } from "../env";
import { safeEqual } from "../security";

/** `Authorization: Bearer $CRON_SECRET`; open only in development when no secret is set. */
export function cronAuthorized(req: Request): boolean {
  const { cronSecret, isProd } = env();
  if (!cronSecret) return !isProd;
  return safeEqual(req.headers.get("authorization"), `Bearer ${cronSecret}`);
}
