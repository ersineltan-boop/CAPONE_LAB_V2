import type { OperatorTextStore } from "../../queue/store";
import { canReplaceExistingDataset } from "../../policies/collectSafety";
import { evaluateAllowlistedCommand } from "../commands/policy";
import { createGitSnapshot, detectMutations } from "../guard/mutation";
import { saveJob, saveReportJson, saveRun } from "../storage/jobStore";
import { formatOwnerSummary } from "../report/ownerSummary";
import { summaryPath } from "../storage/paths";
import { simulateStage } from "./adapters";
import type { GitSnapshot, JobManifest, StepExecutionResult } from "../types";

export interface ExecutorHooks {
  snapshotGit: () => GitSnapshot;
  runCommand?: (argv: readonly string[]) => StepExecutionResult;
}

export interface ExecutorResult {
  job: JobManifest;
  ownerSummary: string;
}

function finish(job: JobManifest, now: Date, why: string): JobManifest {
  const ownerResult = job.blockers.some((item) => item.severity === "FAILED")
    ? "FAILED"
    : job.blockers.some((item) => item.severity === "BLOCKED")
      ? "BLOCKED"
      : "REVIEW";
  return {
    ...job,
    updatedAt: now.toISOString(),
    state: ownerResult === "BLOCKED" ? "BLOCKED" : ownerResult === "FAILED" ? "FAILED" : "REVIEW",
    ownerResult,
    why,
    timestamps: {
      ...job.timestamps,
      finishedAt: now.toISOString(),
    },
  };
}

export function executeJob(
  job: JobManifest,
  store: OperatorTextStore,
  hooks: ExecutorHooks,
  now = new Date(),
): ExecutorResult {
  let current: JobManifest = {
    ...job,
    timestamps: { ...job.timestamps, startedAt: now.toISOString() },
    state: job.state === "QUEUED" ? "DISCOVERING" : job.state,
  };

  const emptyProtect = canReplaceExistingDataset(
    { label: current.targetName ?? "existing", productCount: 1, valid: true },
    { label: "failed-empty", productCount: 0, valid: false },
  );
  if (!emptyProtect.allowed) {
    current = {
      ...current,
      qa: { ...current.qa, emptyCollectProtected: true },
    };
  }

  if (current.parsedIntent.injectionAttempt) {
    current = finish(current, now, current.parsedIntent.reason);
    persist(store, current);
    return { job: current, ownerSummary: formatOwnerSummary(current) };
  }

  const before = hooks.snapshotGit();

  for (let index = 0; index < current.steps.length; index += 1) {
    const step = current.steps[index]!;
    if (step.command && step.command.length > 0) {
      const policy = evaluateAllowlistedCommand(step.command);
      if (policy.decision === "DENY") {
        current = finish(
          {
            ...current,
            blockers: [
              ...current.blockers,
              { code: "COMMAND_DENIED", reason: policy.reason, severity: "BLOCKED" },
            ],
            steps: current.steps.map((item, itemIndex) =>
              itemIndex === index ? { ...item, status: "BLOCKED" } : item,
            ),
          },
          now,
          policy.reason,
        );
        persist(store, current);
        return { job: current, ownerSummary: formatOwnerSummary(current) };
      }
      if (policy.decision === "REQUIRE_OWNER_APPROVAL") {
        current = finish(
          {
            ...current,
            blockers: [
              ...current.blockers,
              { code: "COMMAND_APPROVAL", reason: policy.reason, severity: "BLOCKED" },
            ],
            steps: current.steps.map((item, itemIndex) =>
              itemIndex === index ? { ...item, status: "BLOCKED" } : item,
            ),
          },
          now,
          policy.reason,
        );
        persist(store, current);
        return { job: current, ownerSummary: formatOwnerSummary(current) };
      }
    }

    const simulated = simulateStage(current, step);
    const executed = step.command && hooks.runCommand
      ? hooks.runCommand(step.command)
      : simulated;
    const combined = {
      ...executed,
      blockers: [...simulated.blockers, ...executed.blockers],
    };

    const after = hooks.snapshotGit();
    const mutation = detectMutations(before, after);
    if (mutation.blocked) {
      current = finish(
        {
          ...current,
          productionDataModified: mutation.production.length > 0,
          blockers: [
            ...current.blockers,
            {
              code: "UNEXPECTED_MUTATION",
              reason: mutation.reason ?? "Unexpected file mutation",
              severity: "BLOCKED",
            },
          ],
          steps: current.steps.map((item, itemIndex) =>
            itemIndex === index ? { ...item, status: "BLOCKED" } : item,
          ),
        },
        now,
        mutation.reason ?? "Unexpected file mutation",
      );
      persist(store, current);
      return { job: current, ownerSummary: formatOwnerSummary(current) };
    }

    current = {
      ...current,
      state: step.state,
      blockers: [...current.blockers, ...combined.blockers],
      steps: current.steps.map((item, itemIndex) =>
        itemIndex === index ? { ...item, status: combined.exitCode === 0 ? "RAN" : "BLOCKED" } : item,
      ),
    };

    if (combined.exitCode !== 0 || combined.blockers.some((item) => item.severity === "FAILED")) {
      current = finish(current, now, combined.blockers[0]?.reason ?? "Step failed");
      persist(store, current);
      return { job: current, ownerSummary: formatOwnerSummary(current) };
    }
  }

  current = finish(current, now, current.why);
  persist(store, current);
  return { job: current, ownerSummary: formatOwnerSummary(current) };
}

function persist(store: OperatorTextStore, job: JobManifest): void {
  saveJob(store, job);
  saveRun(store, job);
  const summary = formatOwnerSummary(job);
  saveReportJson(store, job.id, { job, ownerSummary: summary });
  if (store.write) {
    store.write(summaryPath(job.id), summary);
  }
}

export function inspectOnlySnapshot(raw = ""): GitSnapshot {
  return createGitSnapshot(raw);
}
