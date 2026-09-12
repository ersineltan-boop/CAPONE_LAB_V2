import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { OPERATOR_PR_MARKER } from "../github/constants";
import { snapshotsFromCatalogAndStaging } from "./collectCompare";
import {
  assertSafeCommitBranch,
  assertSafePushArgv,
  BOT_IDENTITY,
  isForbiddenBranch,
  safePushArgv,
  stageExactArgv,
  unexpectedHandlerPaths,
} from "./guards";
import { PRODUCTION_PRODUCTS, FREE_PEOPLE_STAGING_PRODUCTS, FREE_PEOPLE_STAGING_REPORT } from "./paths";
import { EXECUTOR_HANDLERS, isRegisteredHandlerCommand } from "./registry";
import { VALIDATION_GATES } from "./gates";
import type {
  BranchPrepareResult,
  CollectSafetySnapshots,
  CommandRunResult,
  ExecutionHost,
  ExistingPullRequest,
  PullRequestDraft,
  PushResult,
  StageResult,
} from "./types";

function argvKey(argv: readonly string[]): string {
  return argv.join("\0");
}

const VALIDATION_KEYS = new Set(VALIDATION_GATES.map((gate) => argvKey(gate.argv)));

function npmBin(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function npxBin(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function adaptArgv(argv: readonly string[]): string[] {
  const copy = [...argv];
  if (copy[0] === "npm") copy[0] = npmBin();
  if (copy[0] === "npx") copy[0] = npxBin();
  return copy;
}

function git(args: readonly string[]): string {
  return execFileSync("git", [...args], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function tryGit(args: readonly string[]): { ok: boolean; stdout: string } {
  try {
    return { ok: true, stdout: git(args) };
  } catch {
    return { ok: false, stdout: "" };
  }
}

function readJsonUnknown(path: string): unknown {
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8")) as unknown;
}

export function isHostAllowedCommand(argv: readonly string[]): boolean {
  return isRegisteredHandlerCommand(argv) || VALIDATION_KEYS.has(argvKey(argv));
}

export function createRealExecutionHost(root = process.cwd()): ExecutionHost {
  const run = (argv: readonly string[]): CommandRunResult => {
    if (!isHostAllowedCommand(argv)) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Refusing unregistered command: ${argv.join(" ")}`,
      };
    }
    try {
      const stdout = execFileSync(adaptArgv(argv)[0]!, adaptArgv(argv).slice(1), {
        cwd: root,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { exitCode: 0, stdout, stderr: "" };
    } catch (error) {
      const err = error as { status?: number; stdout?: string; stderr?: string };
      return {
        exitCode: typeof err.status === "number" ? err.status : 1,
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? (error instanceof Error ? error.message : "command failed"),
      };
    }
  };

  return {
    fetchOriginMain() {
      git(["fetch", "origin", "main"]);
      return { sha: git(["rev-parse", "origin/main"]) };
    },
    currentBranch() {
      return git(["rev-parse", "--abbrev-ref", "HEAD"]);
    },
    createOrReuseTaskBranch({ name, baseSha, issueNumber }): BranchPrepareResult {
      if (isForbiddenBranch(name)) {
        return { status: "conflict", reason: "Executor cannot target main", branch: name };
      }
      git(["fetch", "origin", "main"]);
      const remote = tryGit(["fetch", "origin", name]);
      if (remote.ok) {
        const checked = tryGit(["checkout", name]);
        if (!checked.ok) {
          git(["checkout", "-b", name, `origin/${name}`]);
        }
        const head = git(["rev-parse", "HEAD"]);
        const containsMain = tryGit(["merge-base", "--is-ancestor", baseSha, head]).ok;
        const behindMain = tryGit(["merge-base", "--is-ancestor", head, baseSha]).ok;
        if (containsMain) {
          return { status: "reused", reason: `Reused task branch for issue #${issueNumber}`, branch: name };
        }
        if (behindMain && git(["rev-parse", "HEAD"]) === git(["merge-base", "HEAD", "origin/main"])) {
          git(["merge", "--ff-only", "origin/main"]);
          return { status: "reused", reason: "Fast-forwarded unused task branch to origin/main", branch: name };
        }
        return {
          status: "conflict",
          reason: "Existing task branch diverged from origin/main",
          branch: name,
        };
      }
      git(["checkout", "-b", name, "origin/main"]);
      return { status: "created", reason: "Created task branch from origin/main", branch: name };
    },
    listChangedPaths() {
      const raw = tryGit(["status", "--short"]).stdout;
      return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^[A-Z?!]{1,2}\s+/, "").replace(/^.+ -> /, ""));
    },
    runRegisteredCommand: run,
    collectSnapshots(): CollectSafetySnapshots | null {
      const snapshots = snapshotsFromCatalogAndStaging(
        readJsonUnknown(resolve(root, PRODUCTION_PRODUCTS)),
        readJsonUnknown(resolve(root, FREE_PEOPLE_STAGING_PRODUCTS)),
      );
      const reportPath = resolve(root, FREE_PEOPLE_STAGING_REPORT);
      if (existsSync(reportPath)) {
        const report = JSON.parse(readFileSync(reportPath, "utf-8")) as { status?: string };
        if (report.status === "failed") {
          return {
            ...snapshots,
            incoming: { ...snapshots.incoming, valid: false },
          };
        }
      }
      return snapshots;
    },
    stageExactPaths(paths): StageResult {
      const handler = EXECUTOR_HANDLERS.find((item) => item.id === "product-research-free-people-refresh");
      const rejected = handler ? unexpectedHandlerPaths(paths, handler) : [...paths];
      if (rejected.length > 0) {
        return { staged: [], rejected };
      }
      const argv = stageExactArgv(paths);
      git(argv.slice(1));
      return { staged: [...paths], rejected: [] };
    },
    listStagedPaths() {
      const raw = tryGit(["diff", "--cached", "--name-only"]).stdout;
      return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    },
    commit(message, expectedBranch) {
      assertSafeCommitBranch(git(["rev-parse", "--abbrev-ref", "HEAD"]), expectedBranch);
      execFileSync(
        "git",
        [
          "-c",
          `user.name=${BOT_IDENTITY.name}`,
          "-c",
          `user.email=${BOT_IDENTITY.email}`,
          "commit",
          "-m",
          message,
        ],
        { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
      );
      return { sha: git(["rev-parse", "HEAD"]) };
    },
    pushTaskBranch(branch): PushResult {
      const argv = safePushArgv(branch);
      assertSafePushArgv(argv);
      git(["fetch", "origin"]);
      const current = git(["rev-parse", "--abbrev-ref", "HEAD"]);
      if (current !== branch || isForbiddenBranch(current)) {
        return { ok: false, reason: "Push refused: not on the Operator task branch", argv };
      }
      try {
        git(argv.slice(1));
        return { ok: true, reason: "Pushed task branch", argv };
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : "Push failed",
          argv,
        };
      }
    },
    findExistingPr(branch): ExistingPullRequest | null {
      try {
        const raw = execFileSync(
          "gh",
          ["pr", "list", "--head", branch, "--json", "number,url,body,baseRefName,headRefName"],
          { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
        );
        const items = JSON.parse(raw) as Array<{
          number: number;
          url: string;
          body?: string;
          baseRefName?: string;
          headRefName?: string;
        }>;
        const match =
          items.find((item) => (item.body ?? "").includes(OPERATOR_PR_MARKER)) ?? items[0] ?? null;
        if (!match) return null;
        return {
          number: match.number,
          url: match.url,
          base: match.baseRefName ?? "main",
          head: match.headRefName ?? branch,
          body: match.body ?? "",
        };
      } catch {
        return null;
      }
    },
    createOrUpdatePr(draft: PullRequestDraft, existing: ExistingPullRequest | null): ExistingPullRequest {
      if (draft.base !== "main" || draft.autoMerge !== false) {
        throw new Error("PR must target main and must not auto-merge");
      }
      const bodyFile = resolve(root, "operator-pr-body.md");
      writeFileSync(bodyFile, draft.body, "utf-8");
      if (existing) {
        execFileSync("gh", ["pr", "edit", String(existing.number), "--title", draft.title, "--body-file", bodyFile], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        return { ...existing, base: "main", head: draft.head, body: draft.body };
      }
      const url = execFileSync(
        "gh",
        ["pr", "create", "--base", "main", "--head", draft.head, "--title", draft.title, "--body-file", bodyFile],
        { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
      ).trim();
      const numberMatch = /\/pull\/(\d+)/.exec(url);
      return {
        number: numberMatch ? Number(numberMatch[1]) : 0,
        url,
        base: "main",
        head: draft.head,
        body: draft.body,
      };
    },
  };
}
