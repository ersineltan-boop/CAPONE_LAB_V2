import {
  canReplaceExistingDataset,
  isFailedOrEmptyCollect,
} from "../../policies/collectSafety";
import type { CollectDatasetSnapshot } from "../../types";
import { parseGitStatusShort } from "../guard/mutation";
import { isIgnoredRuntimePath, pathMatchesAllowlist } from "./paths";
import type { ExecutorHandler } from "./types";

export const FORBIDDEN_BRANCHES = ["main", "master"] as const;

export function isForbiddenBranch(name: string): boolean {
  const normalized = name.trim().replace(/^refs\/heads\//, "").toLowerCase();
  return (FORBIDDEN_BRANCHES as readonly string[]).includes(normalized);
}

export function taskBranchName(issueNumber: number): string {
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    throw new Error("Issue number must be a positive integer");
  }
  return `operator/issue-${issueNumber}`;
}

export function branchBelongsToIssue(branch: string, issueNumber: number): boolean {
  return branch.trim() === taskBranchName(issueNumber);
}

export function safePushArgv(branch: string): string[] {
  if (isForbiddenBranch(branch)) {
    throw new Error("Executor cannot push to main");
  }
  if (!branch.startsWith("operator/issue-")) {
    throw new Error("Executor can only push an Operator task branch");
  }
  return ["git", "push", "-u", "origin", branch];
}

export function isForcePushArgv(argv: readonly string[]): boolean {
  return argv.some(
    (item) => item === "--force" || item === "-f" || item === "--force-with-lease",
  );
}

export function isPushToMainArgv(argv: readonly string[]): boolean {
  const parts = argv.map((item) => item.trim());
  if (parts.includes("HEAD:main") || parts.includes("HEAD:master")) return true;
  if (parts[0] === "git" && parts[1] === "push") {
    const dest = parts[parts.length - 1] ?? "";
    return dest === "main" || dest === "master" || dest.endsWith(":main") || dest.endsWith(":master");
  }
  return false;
}

export function assertSafePushArgv(argv: readonly string[]): void {
  if (isForcePushArgv(argv)) {
    throw new Error("Force push is impossible");
  }
  if (isPushToMainArgv(argv)) {
    throw new Error("Push to main is denied");
  }
  if (argv.includes("--force-with-lease")) {
    throw new Error("Force push is impossible");
  }
}

export function stageExactArgv(paths: readonly string[]): string[] {
  if (paths.length === 0) {
    throw new Error("Refusing empty git add");
  }
  if (paths.some((path) => path === "." || path === "-A" || path === "--all" || path === "*")) {
    throw new Error("git add . is forbidden");
  }
  return ["git", "add", "--", ...paths];
}

export function isCatastrophicProductCollapse(existingCount: number, incomingCount: number): boolean {
  return existingCount >= 20 && incomingCount > 0 && incomingCount < Math.ceil(existingCount * 0.5);
}

export function evaluateHandlerCollectSafety(
  existing: CollectDatasetSnapshot,
  incoming: CollectDatasetSnapshot,
):
  | { allowed: true; status: "PASS"; reason: string }
  | { allowed: false; status: "BLOCKED" | "REVIEW"; reason: string } {
  if (isFailedOrEmptyCollect(incoming)) {
    const replace = canReplaceExistingDataset(existing, incoming);
    if (replace.allowed) {
      return { allowed: true, status: "PASS", reason: replace.reason };
    }
    return { allowed: false, status: "BLOCKED", reason: replace.reason };
  }
  const replace = canReplaceExistingDataset(existing, incoming);
  if (!replace.allowed) {
    return { allowed: false, status: "BLOCKED", reason: replace.reason };
  }
  if (isCatastrophicProductCollapse(existing.productCount, incoming.productCount)) {
    return {
      allowed: false,
      status: "REVIEW",
      reason: `Suspicious product-count collapse: ${existing.productCount} → ${incoming.productCount}`,
    };
  }
  return { allowed: true, status: "PASS", reason: replace.reason };
}

export function changedPathsFromStatus(raw: string): string[] {
  return parseGitStatusShort(raw);
}

export function handlerAllowsPath(path: string, handler: ExecutorHandler): boolean {
  return pathMatchesAllowlist(path, handler.allowedExactPaths, handler.allowedPathPrefixes);
}

export function unexpectedHandlerPaths(paths: readonly string[], handler: ExecutorHandler): string[] {
  return paths.filter((path) => !isIgnoredRuntimePath(path) && !handlerAllowsPath(path, handler));
}

export function isTrackedHandlerOutput(path: string, handler: ExecutorHandler): boolean {
  return !isIgnoredRuntimePath(path) && handlerAllowsPath(path, handler);
}

export function assertSafeCommitBranch(currentBranch: string, expectedBranch: string): void {
  if (isForbiddenBranch(currentBranch) || isForbiddenBranch(expectedBranch)) {
    throw new Error("Commit refused: cannot commit on main");
  }
  if (!expectedBranch.startsWith("operator/issue-") || currentBranch !== expectedBranch) {
    throw new Error("Commit refused: not on the Operator task branch");
  }
}

export function commitMessageForIssue(issueNumber: number, summary: string): string {
  const safe = summary.replace(/\s+/g, " ").trim().slice(0, 72);
  return `chore(operator): execute issue #${issueNumber} ${safe}`.trim();
}

export const BOT_IDENTITY = {
  name: "github-actions[bot]",
  email: "41898282+github-actions[bot]@users.noreply.github.com",
} as const;
