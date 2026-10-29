/**
 * Runs once when the server starts. The check lives in a Node-only module so
 * the Edge bundle never sees process.exit.
 */
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkConfigOnStartup } = await import("./startup");
    checkConfigOnStartup();
  }
}

/** Unhandled errors in routes, pages and server actions go to the error tracker and the admin. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { log } = await import("./lib/log");
  log.error("unhandled request error", {
    err,
    path: request.path,
    method: request.method,
    route: context.routePath,
    kind: context.routeType,
  });
};
