import { countSchemes, listPipelineRuns } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness + readiness probe for load balancers, Docker and uptime monitors. */
export async function GET() {
  try {
    const cfg = env();
    const [lastRun] = await listPipelineRuns(1);
    return Response.json({
      status: "ok",
      env: cfg.appEnv,
      schemes: await countSchemes(),
      database: cfg.database.driver,
      channels: { telegram: cfg.telegram.enabled, whatsapp: cfg.whatsapp.enabled },
      ai: !!cfg.groq.apiKey,
      lastPipelineRun: lastRun ? { at: lastRun.startedAt, status: lastRun.status } : null,
    });
  } catch {
    // Never leak error details from a public endpoint.
    return Response.json({ status: "error" }, { status: 503 });
  }
}
