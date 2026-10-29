import { handleMessage } from "@/lib/agent";
import { getOrCreateUser, hitRateLimit } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { clientIp } from "@/lib/security";

export const runtime = "nodejs";

/** Web simulator: lets you try the exact bot flow from the browser. */
export async function POST(req: Request) {
  const cfg = env();
  if (!cfg.webDemoEnabled) return Response.json({ error: "The web demo is disabled." }, { status: 404 });

  // Public endpoint that can trigger Groq calls, so throttle per IP (shared across instances).
  const rl = await hitRateLimit(`chat:${clientIp(req)}`, cfg.chatRateLimitPerMin, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many messages. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: { sessionId?: string; text?: string; optionId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { sessionId, text, optionId } = body;
  if (!sessionId || !/^[\w-]{8,64}$/.test(sessionId)) {
    return Response.json({ error: "sessionId required" }, { status: 400 });
  }
  if ((text?.length ?? 0) > 1000 || (optionId?.length ?? 0) > 200) {
    return Response.json({ error: "Message too long" }, { status: 413 });
  }
  try {
    const user = await getOrCreateUser("web", sessionId);
    const replies = await handleMessage(user, { text: text ?? "", optionId });
    return Response.json({ replies });
  } catch (err) {
    log.error("chat error", { err });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
