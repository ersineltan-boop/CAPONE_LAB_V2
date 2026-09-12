import type { JobManifest } from "../types";
import { resolveExecutorHandler, unsupportedHandlerReason } from "./registry";
import type { ExecutorHandler } from "./types";

export function canAuthorizePhase2BExecution(
  job: JobManifest,
):
  | { ok: true; handler: ExecutorHandler }
  | { ok: false; status: "BLOCKED" | "REVIEW"; reason: string } {
  if (job.ownerResult === "BLOCKED" || job.parsedIntent.injectionAttempt) {
    return { ok: false, status: "BLOCKED", reason: job.why };
  }

  const blocked = job.blockers.find((item) => item.severity === "BLOCKED");
  if (blocked) {
    return { ok: false, status: "BLOCKED", reason: blocked.reason };
  }

  if (job.parsedIntent.ambiguous || !job.domain || !job.destination) {
    return { ok: false, status: "REVIEW", reason: job.why };
  }

  const handler = resolveExecutorHandler(job);
  if (!handler) {
    return { ok: false, status: "REVIEW", reason: unsupportedHandlerReason(job) };
  }

  if (!job.targetName || !job.targetName.trim()) {
    return { ok: false, status: "REVIEW", reason: "Handler target is not resolved" };
  }

  return { ok: true, handler };
}
