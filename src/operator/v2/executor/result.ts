import { OPERATOR_PR_MARKER } from "../github/constants";
import type { JobManifest } from "../types";
import type {
  ExecutionArtifact,
  ExecutionResult,
  ExecutionStatus,
  GateResult,
  PullRequestDraft,
} from "./types";

const EMPTY_GATES = {
  tests: "NOT_RUN" as const,
  typecheck: "NOT_RUN" as const,
  build: "NOT_RUN" as const,
  qa: "NOT_RUN" as const,
};

export function emptyExecutionResult(
  status: ExecutionStatus,
  reason: string,
  extras: Partial<ExecutionResult> = {},
): ExecutionResult {
  return {
    taskId: extras.taskId ?? null,
    issueNumber: extras.issueNumber ?? null,
    baseSha: extras.baseSha ?? null,
    branch: extras.branch ?? null,
    handler: extras.handler ?? null,
    status,
    changedPaths: extras.changedPaths ?? [],
    commitSha: extras.commitSha ?? null,
    pullRequestNumber: extras.pullRequestNumber ?? null,
    pullRequestUrl: extras.pullRequestUrl ?? null,
    tests: extras.tests ?? EMPTY_GATES.tests,
    typecheck: extras.typecheck ?? EMPTY_GATES.typecheck,
    build: extras.build ?? EMPTY_GATES.build,
    qa: extras.qa ?? EMPTY_GATES.qa,
    reason,
    comment: extras.comment ?? null,
    executed: extras.executed ?? false,
    committed: extras.committed ?? false,
    pushed: extras.pushed ?? false,
    productionDataModified: extras.productionDataModified ?? false,
    failedGate: extras.failedGate ?? null,
  };
}

export function toExecutionArtifact(result: ExecutionResult): ExecutionArtifact {
  return {
    taskId: result.taskId,
    issueNumber: result.issueNumber,
    baseSha: result.baseSha,
    branch: result.branch,
    handler: result.handler,
    status: result.status,
    changedPaths: [...result.changedPaths],
    commitSha: result.commitSha,
    pullRequestNumber: result.pullRequestNumber,
    pullRequestUrl: result.pullRequestUrl,
    tests: result.tests,
    typecheck: result.typecheck,
    build: result.build,
    qa: result.qa,
    reason: result.reason,
  };
}

export function artifactContainsForbiddenKey(value: unknown): boolean {
  const text = JSON.stringify(value).toLowerCase();
  return (
    text.includes("github_token") ||
    text.includes("ghs_") ||
    text.includes("node_modules") ||
    text.includes("authorization:")
  );
}

export function gateLabel(value: GateResult): string {
  return value;
}

export function buildPullRequestDraft(input: {
  job: JobManifest;
  issueNumber: number;
  handlerId: string;
  baseSha: string;
  branch: string;
  changedPaths: readonly string[];
  commitSha: string;
  tests: GateResult;
  typecheck: GateResult;
  build: GateResult;
  qa: GateResult;
  collectorSummary?: string | null;
}): PullRequestDraft {
  const body = [
    OPERATOR_PR_MARKER,
    "",
    "## CAPONE Operator execution",
    "",
    `- Source Issue: #${input.issueNumber}`,
    `- task-id: \`${input.job.id}\``,
    `- domain: ${input.job.domain ?? "unknown"}`,
    `- destination: ${input.job.destination ?? "unknown"}`,
    `- target: ${input.job.targetName ?? "unknown"}`,
    `- handler: \`${input.handlerId}\``,
    `- base main SHA: \`${input.baseSha}\``,
    `- execution branch: \`${input.branch}\``,
    `- commit: \`${input.commitSha}\``,
    "",
    "### Changed paths",
    ...(input.changedPaths.length > 0
      ? input.changedPaths.map((path) => `- \`${path}\``)
      : ["- none"]),
    "",
    "### Collector",
    input.collectorSummary ?? "Not a collector task, or no collector summary.",
    "",
    "### Validation",
    `- QA: ${input.qa}`,
    `- Tests: ${input.tests}`,
    `- TypeScript: ${input.typecheck}`,
    `- Build: ${input.build}`,
    "",
    "### Production safety",
    "- READY-FOR-REVIEW only. No merge performed.",
    "- The Operator does not perform a production deployment. Existing Git/Vercel integration may automatically create a preview deployment for a pushed task branch or Pull Request.",
    "- Auto-merge is disabled.",
    "- Task branch only. main was not updated by this workflow.",
  ].join("\n");

  return {
    base: "main",
    head: input.branch,
    title: `chore(operator): issue #${input.issueNumber} ${input.handlerId}`,
    body,
    autoMerge: false,
  };
}

export function findExistingOperatorPr<T extends { body?: string | null; number: number }>(
  pullRequests: readonly T[],
): T | null {
  return pullRequests.find((item) => (item.body ?? "").includes(OPERATOR_PR_MARKER)) ?? null;
}
