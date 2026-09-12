import { commandFromUntrustedTaskText } from "../commands/policy";
import { OPERATOR_EXECUTE_LABEL, OPERATOR_ISSUE_LABEL } from "../github/constants";
import { formatExecutionIssueComment } from "../github/executionComment";
import { isEligibleForExecution, isEligibleGitHubIssue } from "../github/eligibility";
import { processGitHubIssuePayload } from "../github/process";
import { parseGitHubIssuePayloadJson, validateGitHubIssuePayload } from "../github/payload";
import type { JobManifest } from "../types";
import { VALIDATION_GATES } from "./gates";
import {
  assertSafePushArgv,
  branchBelongsToIssue,
  commitMessageForIssue,
  evaluateHandlerCollectSafety,
  isForbiddenBranch,
  safePushArgv,
  taskBranchName,
  unexpectedHandlerPaths,
  isTrackedHandlerOutput,
} from "./guards";
import { resolveExecutorHandler, unsupportedHandlerReason } from "./registry";
import { canAuthorizePhase2BExecution } from "./authorization";
import { buildPullRequestDraft, emptyExecutionResult } from "./result";
import type {
  ExecutionHost,
  ExecutionResult,
  ExecutorHandler,
  GateResult,
  HandlerCommand,
} from "./types";

export { VALIDATION_GATES } from "./gates";

function withComment(result: ExecutionResult, job: JobManifest | null): ExecutionResult {
  return {
    ...result,
    comment: formatExecutionIssueComment(result, job),
  };
}

function keepUntrustedAsData(title: string, body: string): void {
  try {
    commandFromUntrustedTaskText([title, body].filter(Boolean).join("\n"));
  } catch {
    // expected — issue text remains data
  }
}

export function authorizeGitHubIssueExecution(raw: unknown): {
  authorized: boolean;
  status: ExecutionResult["status"];
  reason: string;
  job: JobManifest | null;
  issueNumber: number | null;
} {
  const validated = validateGitHubIssuePayload(raw);
  if (!validated.ok) {
    return {
      authorized: false,
      status: "BLOCKED",
      reason: validated.reason,
      job: null,
      issueNumber: null,
    };
  }

  keepUntrustedAsData(validated.payload.issue.title, validated.payload.issue.body);

  if (validated.payload.issue.pullRequest) {
    return {
      authorized: false,
      status: "BLOCKED",
      reason: "Pull requests are not processed as Operator issues",
      job: null,
      issueNumber: validated.payload.issue.number,
    };
  }

  const intake = isEligibleGitHubIssue(validated.payload);
  if (!intake.eligible) {
    return {
      authorized: false,
      status: "IGNORED",
      reason: intake.reason,
      job: null,
      issueNumber: validated.payload.issue.number,
    };
  }

  const planned = processGitHubIssuePayload(validated.payload);
  const job = planned.job;

  const execution = isEligibleForExecution(validated.payload);
  if (!execution.eligible) {
    return {
      authorized: false,
      status: "IGNORED",
      reason: `Execution requires both ${OPERATOR_ISSUE_LABEL} and ${OPERATOR_EXECUTE_LABEL}`,
      job,
      issueNumber: validated.payload.issue.number,
    };
  }

  if (!job) {
    return {
      authorized: false,
      status: "BLOCKED",
      reason: planned.reason,
      job: null,
      issueNumber: validated.payload.issue.number,
    };
  }

  const executable = canAuthorizePhase2BExecution(job);
  if (!executable.ok) {
    return {
      authorized: false,
      status: executable.status,
      reason: executable.reason,
      job,
      issueNumber: validated.payload.issue.number,
    };
  }

  return {
    authorized: true,
    status: "READY",
    reason: execution.reason,
    job,
    issueNumber: validated.payload.issue.number,
  };
}

function runTaskCommands(
  host: ExecutionHost,
  handler: ExecutorHandler,
): { ok: true; collectorSummary: string | null } | { ok: false; result: ExecutionResult } {
  let collectorSummary: string | null = null;

  for (const command of handler.commands) {
    const ran = runOneCommand(host, handler, command);
    if (!ran.ok) return ran;
    if (command.kind === "collect") {
      const snapshots = host.collectSnapshots();
      if (!snapshots) {
        return {
          ok: false,
          result: emptyExecutionResult("BLOCKED", "Collect snapshots were not available after collect"),
        };
      }
      const safety = evaluateHandlerCollectSafety(snapshots.existing, snapshots.incoming);
      collectorSummary = `${snapshots.incoming.label}: ${snapshots.incoming.productCount} products (${safety.status})`;
      if (!safety.allowed) {
        return {
          ok: false,
          result: emptyExecutionResult(safety.status, safety.reason, {
            executed: true,
            handler: handler.id,
            qa: "FAIL",
            failedGate: "collect-safety",
          }),
        };
      }
    }
  }

  return { ok: true, collectorSummary };
}

function runOneCommand(
  host: ExecutionHost,
  handler: ExecutorHandler,
  command: HandlerCommand,
): { ok: true } | { ok: false; result: ExecutionResult } {
  if (!handler.commands.some((item) => item.argv.join("\0") === command.argv.join("\0"))) {
    return {
      ok: false,
      result: emptyExecutionResult("BLOCKED", "Command is not owned by the selected handler", {
        handler: handler.id,
        failedGate: "handler-registry",
      }),
    };
  }
  const ran = host.runRegisteredCommand(command.argv);
  if (ran.exitCode !== 0) {
    const failedGate = command.kind === "collect" ? "collect" : command.kind;
    return {
      ok: false,
      result: emptyExecutionResult("FAILED", `Handler command failed: ${command.argv.join(" ")}`, {
        executed: true,
        handler: handler.id,
        failedGate,
        qa: command.kind === "collect" ? "FAIL" : "NOT_RUN",
      }),
    };
  }
  return { ok: true };
}

function runValidationGates(
  host: ExecutionHost,
): { ok: true; tests: GateResult; typecheck: GateResult; build: GateResult; qa: GateResult } | { ok: false; result: ExecutionResult } {
  const gates: { tests: GateResult; typecheck: GateResult; build: GateResult; qa: GateResult } = {
    tests: "NOT_RUN",
    typecheck: "NOT_RUN",
    build: "NOT_RUN",
    qa: "NOT_RUN",
  };

  for (const gate of VALIDATION_GATES) {
    const ran = host.runRegisteredCommand(gate.argv);
    const next: GateResult = ran.exitCode === 0 ? "PASS" : "FAIL";
    gates[gate.field] = next;
    if (ran.exitCode !== 0) {
      return {
        ok: false,
        result: emptyExecutionResult("FAILED", `Validation gate failed: ${gate.name}`, {
          executed: true,
          failedGate: gate.name,
          ...gates,
        }),
      };
    }
  }

  return { ok: true, ...gates };
}

export function executeAuthorizedJob(
  job: JobManifest,
  issueNumber: number,
  host: ExecutionHost,
): ExecutionResult {
  const handler = resolveExecutorHandler(job);
  if (!handler) {
    return withComment(
      emptyExecutionResult("REVIEW", unsupportedHandlerReason(job), {
        taskId: job.id,
        issueNumber,
        executed: false,
      }),
      job,
    );
  }

  const origin = host.fetchOriginMain();
  const branch = taskBranchName(issueNumber);
  if (isForbiddenBranch(branch) || !branchBelongsToIssue(branch, issueNumber)) {
    return withComment(
      emptyExecutionResult("BLOCKED", "Executor cannot target main", {
        taskId: job.id,
        issueNumber,
        handler: handler.id,
        baseSha: origin.sha,
      }),
      job,
    );
  }

  const prepared = host.createOrReuseTaskBranch({
    name: branch,
    baseSha: origin.sha,
    issueNumber,
  });
  if (prepared.status === "conflict") {
    return withComment(
      emptyExecutionResult("BLOCKED", prepared.reason, {
        taskId: job.id,
        issueNumber,
        handler: handler.id,
        baseSha: origin.sha,
        branch,
      }),
      job,
    );
  }

  const current = host.currentBranch();
  if (isForbiddenBranch(current) || current !== branch) {
    return withComment(
      emptyExecutionResult("BLOCKED", "Executor cannot target main", {
        taskId: job.id,
        issueNumber,
        handler: handler.id,
        baseSha: origin.sha,
        branch,
      }),
      job,
    );
  }

  const task = runTaskCommands(host, handler);
  if (!task.ok) {
    return withComment(
      {
        ...task.result,
        taskId: job.id,
        issueNumber,
        handler: handler.id,
        baseSha: origin.sha,
        branch,
      },
      job,
    );
  }

  const changedPaths = host.listChangedPaths();
  const unexpected = unexpectedHandlerPaths(changedPaths, handler);
  if (unexpected.length > 0) {
    return withComment(
      emptyExecutionResult("BLOCKED", `Unexpected changed path: ${unexpected.join(", ")}`, {
        taskId: job.id,
        issueNumber,
        handler: handler.id,
        baseSha: origin.sha,
        branch,
        changedPaths,
        executed: true,
        failedGate: "mutation-allowlist",
      }),
      job,
    );
  }

  const gates = runValidationGates(host);
  if (!gates.ok) {
    return withComment(
      {
        ...gates.result,
        taskId: job.id,
        issueNumber,
        handler: handler.id,
        baseSha: origin.sha,
        branch,
        changedPaths,
      },
      job,
    );
  }

  const trackedChanges = changedPaths.filter((path) => isTrackedHandlerOutput(path, handler));
  if (trackedChanges.length === 0) {
    return withComment(
      emptyExecutionResult("NO_CHANGES", "Execution completed with no repository changes", {
        taskId: job.id,
        issueNumber,
        handler: handler.id,
        baseSha: origin.sha,
        branch,
        changedPaths,
        executed: true,
        tests: gates.tests,
        typecheck: gates.typecheck,
        build: gates.build,
        qa: gates.qa,
      }),
      job,
    );
  }

  const staged = host.stageExactPaths(trackedChanges);
  if (staged.rejected.length > 0) {
    return withComment(
      emptyExecutionResult("BLOCKED", `Refused to stage unexpected paths: ${staged.rejected.join(", ")}`, {
        taskId: job.id,
        issueNumber,
        handler: handler.id,
        baseSha: origin.sha,
        branch,
        changedPaths,
        executed: true,
        failedGate: "stage-allowlist",
        tests: gates.tests,
        typecheck: gates.typecheck,
        build: gates.build,
        qa: gates.qa,
      }),
      job,
    );
  }

  const stagedPaths = host.listStagedPaths();
  const unexpectedStaged = unexpectedHandlerPaths(stagedPaths, handler);
  if (unexpectedStaged.length > 0) {
    return withComment(
      emptyExecutionResult("BLOCKED", `Staged diff contains unexpected paths: ${unexpectedStaged.join(", ")}`, {
        taskId: job.id,
        issueNumber,
        handler: handler.id,
        baseSha: origin.sha,
        branch,
        changedPaths,
        executed: true,
        failedGate: "staged-diff",
        tests: gates.tests,
        typecheck: gates.typecheck,
        build: gates.build,
        qa: gates.qa,
      }),
      job,
    );
  }

  const message = commitMessageForIssue(issueNumber, `${handler.id}`);
  let committed: { sha: string };
  try {
    committed = host.commit(message, branch);
  } catch (error) {
    return withComment(
      emptyExecutionResult("BLOCKED", error instanceof Error ? error.message : "Commit refused", {
        taskId: job.id,
        issueNumber,
        handler: handler.id,
        baseSha: origin.sha,
        branch,
        changedPaths: trackedChanges,
        executed: true,
        committed: false,
        failedGate: "commit-branch",
        tests: gates.tests,
        typecheck: gates.typecheck,
        build: gates.build,
        qa: gates.qa,
      }),
      job,
    );
  }
  const pushArgv = safePushArgv(branch);
  assertSafePushArgv(pushArgv);
  const pushed = host.pushTaskBranch(branch);
  if (!pushed.ok) {
    return withComment(
      emptyExecutionResult("FAILED", pushed.reason, {
        taskId: job.id,
        issueNumber,
        handler: handler.id,
        baseSha: origin.sha,
        branch,
        changedPaths: trackedChanges,
        commitSha: committed.sha,
        committed: true,
        executed: true,
        failedGate: "push",
        tests: gates.tests,
        typecheck: gates.typecheck,
        build: gates.build,
        qa: gates.qa,
      }),
      job,
    );
  }
  assertSafePushArgv(pushed.argv);

  const existing = host.findExistingPr(branch);
  const draft = buildPullRequestDraft({
    job,
    issueNumber,
    handlerId: handler.id,
    baseSha: origin.sha,
    branch,
    changedPaths: trackedChanges,
    commitSha: committed.sha,
    tests: gates.tests,
    typecheck: gates.typecheck,
    build: gates.build,
    qa: gates.qa,
    collectorSummary: task.collectorSummary,
  });
  if (draft.base !== "main" || draft.autoMerge !== false) {
    return withComment(
      emptyExecutionResult("BLOCKED", "PR must target main and must not auto-merge", {
        taskId: job.id,
        issueNumber,
        handler: handler.id,
        baseSha: origin.sha,
        branch,
        changedPaths: trackedChanges,
        commitSha: committed.sha,
        committed: true,
        pushed: true,
        executed: true,
      }),
      job,
    );
  }
  const pr = host.createOrUpdatePr(draft, existing);

  return withComment(
    emptyExecutionResult("READY", "Phase 2B execution completed and opened a ready-for-review PR", {
      taskId: job.id,
      issueNumber,
      handler: handler.id,
      baseSha: origin.sha,
      branch,
      changedPaths: trackedChanges,
      commitSha: committed.sha,
      pullRequestNumber: pr.number,
      pullRequestUrl: pr.url,
      tests: gates.tests,
      typecheck: gates.typecheck,
      build: gates.build,
      qa: gates.qa,
      executed: true,
      committed: true,
      pushed: true,
      productionDataModified: trackedChanges.some((path) => path.startsWith("data/")),
    }),
    job,
  );
}

export function authorizeAndExecuteGitHubIssue(raw: unknown, host: ExecutionHost): ExecutionResult {
  const auth = authorizeGitHubIssueExecution(raw);
  if (!auth.authorized || !auth.job || auth.issueNumber == null) {
    const result = emptyExecutionResult(auth.status, auth.reason, {
      taskId: auth.job?.id ?? null,
      issueNumber: auth.issueNumber,
      executed: false,
    });
    if (auth.status === "IGNORED") {
      return { ...result, comment: null };
    }
    return withComment(result, auth.job);
  }
  return executeAuthorizedJob(auth.job, auth.issueNumber, host);
}

export function authorizeAndExecuteGitHubIssueText(text: string, host: ExecutionHost): ExecutionResult {
  const parsed = parseGitHubIssuePayloadJson(text);
  if (!parsed.ok) {
    return withComment(emptyExecutionResult("BLOCKED", parsed.reason), null);
  }
  return authorizeAndExecuteGitHubIssue(parsed.payload, host);
}
