import { after } from "next/server";
import { log } from "@/lib/log";
import { cronAuthorized } from "@/lib/pipeline/auth";
import {
  PipelineBusyError,
  beginPipelineRun,
  executePipelineRun,
  runPipeline,
  runningPipelineRunId,
} from "@/lib/pipeline/run";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Starts a pipeline run. By default it replies 202 at once and runs in the
 * background, so cron jobs and proxies never time out; poll
 * /api/pipeline/status?id=<runId> for progress. Add ?wait=1 to block until done.
 * Vercel Cron issues GET requests with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const busy = async () =>
    Response.json(
      { error: "A pipeline run is already in progress", runId: await runningPipelineRunId() },
      { status: 409 },
    );

  if (url.searchParams.get("wait") === "1") {
    try {
      return Response.json(await runPipeline({ force }));
    } catch (err) {
      if (err instanceof PipelineBusyError) return await busy();
      log.warn("pipeline run failed (already reported)", { err });
      return Response.json({ error: "pipeline failed" }, { status: 500 });
    }
  }

  const runId = await beginPipelineRun();
  if (runId == null) return await busy();
  after(async () => {
    try {
      const r = await executePipelineRun(runId, { force });
      log.info("pipeline run finished", {
        runId,
        newForReview: r.newForReview,
        windowsForReview: r.windowsForReview,
        failedSources: r.failedSources.length,
        ...r.notifications,
      });
    } catch (err) {
      log.warn("pipeline run failed (already reported)", { runId, err });
    }
  });
  return Response.json(
    { runId, status: "running", statusUrl: `/api/pipeline/status?id=${runId}` },
    { status: 202 },
  );
}

export const POST = GET;
