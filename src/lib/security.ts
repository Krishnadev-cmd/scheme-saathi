import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time string comparison (hashing first makes lengths equal). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Best-effort client IP behind a proxy / load balancer. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Fixed-window rate limiter kept in memory. Good enough for a single instance;
 * use Redis or the database when running several instances.
 */
export function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; reset: number }>();
  return function check(key: string): { ok: boolean; retryAfter: number } {
    const now = Date.now();
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return { ok: true, retryAfter: 0 };
    }
    entry.count++;
    return { ok: entry.count <= limit, retryAfter: Math.ceil((entry.reset - now) / 1000) };
  };
}
