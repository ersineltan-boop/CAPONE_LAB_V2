import type { CollectDatasetSnapshot } from "../../types";
import type { JobManifest, V2TemplateId } from "../types";

export const EXECUTION_STATUSES = [
  "READY",
  "REVIEW",
  "BLOCKED",
  "FAILED",
  "NO_CHANGES",
  "IGNORED",
] as const;

export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const GATE_RESULTS = ["PASS", "FAIL", "NOT_RUN"] as const;

export type GateResult = (typeof GATE_RESULTS)[number];

export type HandlerCommandKind = "collect" | "merge" | "qa" | "task";

export interface HandlerCommand {
  argv: readonly string[];
  kind: HandlerCommandKind;
}

export interface ExecutorHandler {
  id: string;
  templates: readonly V2TemplateId[];
  match: (job: JobManifest) => boolean;
  commands: readonly HandlerCommand[];
  allowedExactPaths: readonly string[];
  allowedPathPrefixes: readonly string[];
  requiresCollectSafety: boolean;
}

export interface CommandRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CollectSafetySnapshots {
  existing: CollectDatasetSnapshot;
  incoming: CollectDatasetSnapshot;
}

export interface ExistingPullRequest {
  number: number;
  url: string;
  base: string;
  head: string;
  body: string;
}

export interface PullRequestDraft {
  base: "main";
  head: string;
  title: string;
  body: string;
  autoMerge: false;
}

export interface BranchPrepareResult {
  status: "created" | "reused" | "conflict";
  reason: string;
  branch: string;
}

export interface StageResult {
  staged: string[];
  rejected: string[];
}

export interface PushResult {
  ok: boolean;
  reason: string;
  argv: readonly string[];
}

export interface CommitResult {
  sha: string;
}

export interface ExecutionHost {
  fetchOriginMain(): { sha: string };
  currentBranch(): string;
  createOrReuseTaskBranch(input: {
    name: string;
    baseSha: string;
    issueNumber: number;
  }): BranchPrepareResult;
  listChangedPaths(): string[];
  runRegisteredCommand(argv: readonly string[]): CommandRunResult;
  collectSnapshots(): CollectSafetySnapshots | null;
  stageExactPaths(paths: readonly string[]): StageResult;
  listStagedPaths(): string[];
  commit(message: string, expectedBranch: string): CommitResult;
  pushTaskBranch(branch: string): PushResult;
  findExistingPr(branch: string): ExistingPullRequest | null;
  createOrUpdatePr(draft: PullRequestDraft, existing: ExistingPullRequest | null): ExistingPullRequest;
}

export interface ExecutionResult {
  taskId: string | null;
  issueNumber: number | null;
  baseSha: string | null;
  branch: string | null;
  handler: string | null;
  status: ExecutionStatus;
  changedPaths: string[];
  commitSha: string | null;
  pullRequestNumber: number | null;
  pullRequestUrl: string | null;
  tests: GateResult;
  typecheck: GateResult;
  build: GateResult;
  qa: GateResult;
  reason: string;
  comment: string | null;
  executed: boolean;
  committed: boolean;
  pushed: boolean;
  productionDataModified: boolean;
  failedGate: string | null;
}

export interface ExecutionArtifact {
  taskId: string | null;
  issueNumber: number | null;
  baseSha: string | null;
  branch: string | null;
  handler: string | null;
  status: ExecutionStatus;
  changedPaths: string[];
  commitSha: string | null;
  pullRequestNumber: number | null;
  pullRequestUrl: string | null;
  tests: GateResult;
  typecheck: GateResult;
  build: GateResult;
  qa: GateResult;
  reason: string;
}
