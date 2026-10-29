import { getPipelineRun, listPipelineRuns } from "@/lib/db";
import { cronAuthorized } from "@/lib/pipeline/auth";
import { countPendingReview } from "@/lib/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Progress of a pipeline run: /api/pipeline/status?id=<runId>, or the latest run without an id. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  const run = Number.isInteger(id) && id > 0 ? await getPipelineRun(id) : (await listPipelineRuns(1))[0];
  if (!run) return Response.json({ error: "run not found" }, { status: 404 });
  return Response.json({ ...run, log: run.log.split("\n"), pendingReview: await countPendingReview() });
}
