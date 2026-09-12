import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { commandFromUntrustedTaskText } from "../commands/policy";
import { canAuthorizePhase2BExecution } from "../executor/authorization";
import {
  authorizeAndExecuteGitHubIssue,
  authorizeAndExecuteGitHubIssueText,
  authorizeGitHubIssueExecution,
} from "../executor/execute";
import {
  snapshotsFromCatalogAndStaging,
} from "../executor/collectCompare";
import {
  assertSafeCommitBranch,
  assertSafePushArgv,
  evaluateHandlerCollectSafety,
  isForbiddenBranch,
  isForcePushArgv,
  isPushToMainArgv,
  safePushArgv,
  stageExactArgv,
  taskBranchName,
  unexpectedHandlerPaths,
} from "../executor/guards";
import { isFreePeopleModelFamilyOutput } from "../executor/paths";
import {
  isRegisteredHandlerCommand,
  PRODUCT_RESEARCH_FREE_PEOPLE_REFRESH,
  resolveExecutorHandler,
  unsupportedHandlerReason,
} from "../executor/registry";
import { artifactContainsForbiddenKey, findExistingOperatorPr, toExecutionArtifact } from "../executor/result";
import type { ExecutionHost, ExistingPullRequest } from "../executor/types";
import { findExistingOperatorComment, formatGitHubIssueComment } from "../github/comment";
import {
  OPERATOR_EXECUTE_LABEL,
  OPERATOR_ISSUE_LABEL,
  OPERATOR_PR_MARKER,
  OPERATOR_REPORT_MARKER,
} from "../github/constants";
import { formatExecutionIssueComment } from "../github/executionComment";
import { isEligibleForExecution, isEligibleGitHubIssue } from "../github/eligibility";
import { processGitHubIssuePayload } from "../github/process";
import type { GitHubIssuePayload } from "../github/payload";
import { parseGitStatusShort } from "../guard/mutation";
import { createJobManifest } from "../job/create";
import { parseOperatorIntake } from "../intake/parse";

function payload(
  overrides: Partial<Omit<GitHubIssuePayload, "issue">> & {
    issue?: Partial<GitHubIssuePayload["issue"]>;
  } = {},
): GitHubIssuePayload {
  return {
    eventName: overrides.eventName ?? "issues",
    action: overrides.action ?? "labeled",
    repository: overrides.repository ?? "ersin/CAPONE_OPERATOR",
    issue: {
      number: overrides.issue?.number ?? 12,
      title: overrides.issue?.title ?? "Free People ürünlerini güncelle",
      body: overrides.issue?.body ?? "",
      user: overrides.issue?.user ?? "ersin",
      htmlUrl: overrides.issue?.htmlUrl ?? "https://github.com/ersin/CAPONE_OPERATOR/issues/12",
      createdAt: overrides.issue?.createdAt ?? "2026-09-12T15:00:00.000Z",
      labels: overrides.issue?.labels ?? [OPERATOR_ISSUE_LABEL, OPERATOR_EXECUTE_LABEL],
      pullRequest: overrides.issue?.pullRequest ?? false,
    },
  };
}

function throwingHost(): ExecutionHost {
  const boom = (): never => {
    throw new Error("execution host must not be used");
  };
  return {
    fetchOriginMain: boom,
    currentBranch: boom,
    createOrReuseTaskBranch: boom,
    listChangedPaths: boom,
    runRegisteredCommand: boom,
    collectSnapshots: boom,
    stageExactPaths: boom,
    listStagedPaths: boom,
    commit: boom,
    pushTaskBranch: boom,
    findExistingPr: boom,
    createOrUpdatePr: boom,
  };
}

function createMemoryHost(
  options: {
    currentBranch?: string;
    stayOnCurrentBranch?: boolean;
    branchConflict?: boolean;
    changedPaths?: string[];
    failCommand?: string;
    collect?: ReturnType<ExecutionHost["collectSnapshots"]>;
    existingPr?: ExistingPullRequest | null;
    rejectStage?: string[];
  } = {},
): ExecutionHost & {
  calls: {
    commands: string[][];
    staged: string[][];
    commits: number;
    pushes: string[][];
    prCreates: number;
    prUpdates: number;
  };
} {
  let branch = options.currentBranch ?? "operator/issue-12";
  let staged: string[] = [];
  const calls = {
    commands: [] as string[][],
    staged: [] as string[][],
    commits: 0,
    pushes: [] as string[][],
    prCreates: 0,
    prUpdates: 0,
  };

  return {
    calls,
    fetchOriginMain: () => ({ sha: "038a2f6c3e36ce30ca0d5d6a11709463a931ad96" }),
    currentBranch: () => branch,
    createOrReuseTaskBranch(input) {
      if (options.branchConflict) {
        return { status: "conflict", reason: "Existing task branch diverged from origin/main", branch: input.name };
      }
      if (!options.stayOnCurrentBranch) {
        branch = input.name;
      }
      return { status: "created", reason: "created", branch: input.name };
    },
    listChangedPaths: () => options.changedPaths ?? ["data/multibrand/products.json"],
    runRegisteredCommand(argv) {
      calls.commands.push([...argv]);
      const key = argv.join(" ");
      if (options.failCommand && key === options.failCommand) {
        return { exitCode: 1, stdout: "", stderr: "failed" };
      }
      return { exitCode: 0, stdout: "ok", stderr: "" };
    },
    collectSnapshots: () =>
      options.collect ?? {
        existing: { label: "free-people-production", productCount: 900, valid: true },
        incoming: { label: "free-people-staging", productCount: 960, valid: true },
      },
    stageExactPaths(paths) {
      if (paths.some((path) => path === "." || path === "--all")) {
        throw new Error("git add . is forbidden");
      }
      calls.staged.push([...paths]);
      if (options.rejectStage && options.rejectStage.length > 0) {
        return { staged: [], rejected: options.rejectStage };
      }
      staged = [...paths];
      return { staged, rejected: [] };
    },
    listStagedPaths: () => staged,
    commit(_message, expectedBranch) {
      assertSafeCommitBranch(branch, expectedBranch);
      calls.commits += 1;
      return { sha: "commitsha123" };
    },
    pushTaskBranch(nextBranch) {
      const argv = safePushArgv(nextBranch);
      assertSafePushArgv(argv);
      calls.pushes.push([...argv]);
      return { ok: true, reason: "pushed", argv };
    },
    findExistingPr: () => options.existingPr ?? null,
    createOrUpdatePr(draft, existing) {
      expect(draft.base).toBe("main");
      expect(draft.autoMerge).toBe(false);
      expect(draft.body).toContain(OPERATOR_PR_MARKER);
      if (existing) {
        calls.prUpdates += 1;
        return { ...existing, body: draft.body, base: "main", head: draft.head };
      }
      calls.prCreates += 1;
      return {
        number: 44,
        url: "https://github.com/ersin/CAPONE_OPERATOR/pull/44",
        base: draft.base,
        head: draft.head,
        body: draft.body,
      };
    },
  };
}

describe("Phase 2B execution authorization", () => {
  it("does not execute with only capone-operator", () => {
    const raw = payload({ issue: { labels: [OPERATOR_ISSUE_LABEL] } });
    expect(isEligibleGitHubIssue(raw).eligible).toBe(true);
    expect(isEligibleForExecution(raw).eligible).toBe(false);
    const result = authorizeAndExecuteGitHubIssue(raw, throwingHost());
    expect(result.status).toBe("IGNORED");
    expect(result.executed).toBe(false);
    expect(result.committed).toBe(false);
    expect(result.comment).toBeNull();
  });

  it("is eligible when both labels are present", () => {
    const raw = payload();
    expect(isEligibleForExecution(raw).eligible).toBe(true);
    const auth = authorizeGitHubIssueExecution(raw);
    expect(auth.authorized).toBe(true);
    expect(auth.job?.template).toBe("PRODUCT_RESEARCH_REFRESH");
  });

  it("does not treat generic Phase 2A REVIEW as executable REVIEW", () => {
    const generic = authorizeGitHubIssueExecution(
      payload({ issue: { title: "Massimo Dutti ekle" } }),
    );
    expect(generic.job?.ownerResult).toBe("REVIEW");
    expect(generic.job?.parsedIntent.ambiguous).toBe(true);
    expect(canAuthorizePhase2BExecution(generic.job!).ok).toBe(false);
    expect(generic.authorized).toBe(false);
    expect(generic.status).toBe("REVIEW");

    const executable = authorizeGitHubIssueExecution(payload());
    expect(executable.job?.ownerResult).toBe("REVIEW");
    expect(executable.job?.parsedIntent.ambiguous).toBe(false);
    expect(canAuthorizePhase2BExecution(executable.job!).ok).toBe(true);
    expect(executable.authorized).toBe(true);

    const onboarding = authorizeGitHubIssueExecution(
      payload({ issue: { title: "Massimo Dutti'yi Markalar'a ekle" } }),
    );
    expect(onboarding.job?.ownerResult).toBe("REVIEW");
    expect(onboarding.authorized).toBe(false);
    expect(onboarding.reason).toMatch(/UNSUPPORTED_HANDLER/);
  });

  it("rejects a pull request treated as an issue", () => {
    const result = authorizeAndExecuteGitHubIssue(
      payload({ issue: { pullRequest: true } }),
      throwingHost(),
    );
    expect(result.status).toBe("BLOCKED");
    expect(result.executed).toBe(false);
    expect(result.reason).toMatch(/pull request/i);
  });

  it("blocks a malformed payload", () => {
    const result = authorizeAndExecuteGitHubIssueText("{not-json", throwingHost());
    expect(result.status).toBe("BLOCKED");
    expect(result.executed).toBe(false);
    expect(result.committed).toBe(false);
  });
});

describe("Phase 2B untrusted issue text", () => {
  it("keeps force-push, rm, reset, and metacharacters as plain data", () => {
    const title = "git push --force; rm -rf data && git reset --hard `reboot`";
    expect(() => commandFromUntrustedTaskText(title)).toThrow(/never become raw shell input/);
    const result = authorizeAndExecuteGitHubIssue(
      payload({ issue: { title, body: "rm -rf / && echo $(whoami)" } }),
      throwingHost(),
    );
    expect(result.executed).toBe(false);
    expect(result.committed).toBe(false);
    expect(result.status).toBe("BLOCKED");
    expect(result.reason).not.toMatch(/^git push/);
  });
});

describe("Phase 2B handler registry", () => {
  it("returns REVIEW for unsupported handlers without mutating", () => {
    const host = createMemoryHost();
    const onboarding = authorizeAndExecuteGitHubIssue(
      payload({ issue: { title: "Massimo Dutti'yi Markalar'a ekle" } }),
      host,
    );
    expect(onboarding.status).toBe("REVIEW");
    expect(onboarding.reason).toMatch(/UNSUPPORTED_HANDLER/);
    expect(host.calls.commits).toBe(0);
    expect(host.calls.pushes).toHaveLength(0);

    const market = authorizeAndExecuteGitHubIssue(
      payload({ issue: { title: "Romanya Pazar Araştırmasına Botta ekle" } }),
      host,
    );
    expect(market.status).toBe("REVIEW");
    expect(market.reason).toMatch(/Market Research|UNSUPPORTED_HANDLER/i);

    const farfetch = authorizeAndExecuteGitHubIssue(
      payload({ issue: { title: "Farfetch ürünlerini güncelle" } }),
      throwingHost(),
    );
    expect(farfetch.status).toBe("REVIEW");
    expect(farfetch.executed).toBe(false);
    expect(farfetch.reason).toMatch(/UNSUPPORTED_HANDLER/);
  });

  it("routes Free People refresh to the fixed handler", () => {
    const job = createJobManifest({ rawInstruction: "Free People ürünlerini güncelle" });
    const handler = resolveExecutorHandler(job);
    expect(handler?.id).toBe(PRODUCT_RESEARCH_FREE_PEOPLE_REFRESH.id);
    expect(handler?.commands.map((item) => item.argv.join(" "))).toEqual([
      "npm run collect:free-people-staging",
      "npm run merge:free-people-staging",
      "npm run analyze:multibrand",
      "npm run build:model-families",
      "npm run taxonomy:qa",
    ]);
  });

  it("does not accept arbitrary script names", () => {
    expect(isRegisteredHandlerCommand(["npm", "run", "collect:free-people-staging"])).toBe(true);
    expect(isRegisteredHandlerCommand(["npm", "run", "analyze:multibrand"])).toBe(true);
    expect(isRegisteredHandlerCommand(["npm", "run", "build:model-families"])).toBe(true);
    expect(isRegisteredHandlerCommand(["npm", "run", "taxonomy:qa"])).toBe(true);
    expect(isRegisteredHandlerCommand(["npm", "run", "collect:multibrand"])).toBe(false);
    expect(isRegisteredHandlerCommand(["npm", "run", "refresh:cloud"])).toBe(false);
    expect(isRegisteredHandlerCommand(["npm", "run", "onboard:brands"])).toBe(false);
    expect(isRegisteredHandlerCommand(["bash", "-c", "rm -rf /"])).toBe(false);
  });
});

describe("Phase 2B branch and push safety", () => {
  it("cannot target main", () => {
    expect(isForbiddenBranch("main")).toBe(true);
    expect(taskBranchName(12)).toBe("operator/issue-12");
    expect(() => safePushArgv("main")).toThrow(/cannot push to main/i);
    const host = createMemoryHost({ currentBranch: "main", stayOnCurrentBranch: true });
    const result = authorizeAndExecuteGitHubIssue(payload(), host);
    expect(result.status).toBe("BLOCKED");
    expect(result.reason).toMatch(/cannot target main/i);
    expect(host.calls.commits).toBe(0);
  });

  it("refuses commit when the current branch is main", () => {
    const host = createMemoryHost({ currentBranch: "main", stayOnCurrentBranch: true });
    expect(() => host.commit("chore(operator): execute issue #12", "operator/issue-12")).toThrow(
      /cannot commit on main/i,
    );
    expect(host.calls.commits).toBe(0);
    expect(() => assertSafeCommitBranch("main", "operator/issue-12")).toThrow(/cannot commit on main/i);
    expect(() => assertSafeCommitBranch("operator/issue-12", "operator/issue-12")).not.toThrow();
  });

  it("makes force push impossible", () => {
    const argv = safePushArgv("operator/issue-12");
    expect(argv).toEqual(["git", "push", "-u", "origin", "operator/issue-12"]);
    expect(isForcePushArgv(argv)).toBe(false);
    expect(isPushToMainArgv(argv)).toBe(false);
    expect(() => assertSafePushArgv(["git", "push", "--force", "origin", "operator/issue-12"])).toThrow(
      /force push/i,
    );
    expect(() => assertSafePushArgv(["git", "push", "origin", "HEAD:main"])).toThrow(/main/i);
  });
});

describe("Phase 2B mutation and collect gates", () => {
  it("blocks unexpected changed paths and does not commit", () => {
    const host = createMemoryHost({
      changedPaths: ["data/multibrand/products.json", "src/app/secret.ts"],
    });
    const result = authorizeAndExecuteGitHubIssue(payload(), host);
    expect(result.status).toBe("BLOCKED");
    expect(result.failedGate).toBe("mutation-allowlist");
    expect(host.calls.commits).toBe(0);
    expect(host.calls.pushes).toHaveLength(0);
    expect(host.calls.prCreates).toBe(0);
  });

  it("does not commit after a failed collector", () => {
    const host = createMemoryHost({
      failCommand: "npm run collect:free-people-staging",
    });
    const result = authorizeAndExecuteGitHubIssue(payload(), host);
    expect(result.status).toBe("FAILED");
    expect(result.failedGate).toBe("collect");
    expect(host.calls.commits).toBe(0);
    expect(host.calls.commands.some((argv) => argv.includes("merge:free-people-staging"))).toBe(false);
  });

  it("does not commit after an empty collector", () => {
    const host = createMemoryHost({
      collect: {
        existing: { label: "free-people-production", productCount: 900, valid: true },
        incoming: { label: "free-people-staging", productCount: 0, valid: false },
      },
    });
    const result = authorizeAndExecuteGitHubIssue(payload(), host);
    expect(result.status).toBe("BLOCKED");
    expect(result.failedGate).toBe("collect-safety");
    expect(host.calls.commits).toBe(0);
    expect(host.calls.commands.some((argv) => argv.includes("merge:free-people-staging"))).toBe(false);
    expect(
      evaluateHandlerCollectSafety(
        { label: "valid", productCount: 20, valid: true },
        { label: "empty", productCount: 0, valid: false },
      ).allowed,
    ).toBe(false);
  });

  it("compares Free People subset counts, not the full catalog", () => {
    const catalog = [
      ...Array.from({ length: 1000 }, () => ({ source: "zara" })),
      ...Array.from({ length: 100 }, () => ({ source: "free-people" })),
    ];
    const healthyStaging = Array.from({ length: 80 }, () => ({ source: "free-people" }));
    const healthy = snapshotsFromCatalogAndStaging(catalog, healthyStaging);
    expect(healthy.existing.productCount).toBe(100);
    expect(healthy.incoming.productCount).toBe(80);
    expect(healthy.existing.productCount + 1000).toBe(1100);
    expect(evaluateHandlerCollectSafety(healthy.existing, healthy.incoming).allowed).toBe(true);

    const collapsed = snapshotsFromCatalogAndStaging(
      catalog,
      Array.from({ length: 20 }, () => ({ source: "free-people" })),
    );
    expect(collapsed.existing.productCount).toBe(100);
    expect(collapsed.incoming.productCount).toBe(20);
    expect(evaluateHandlerCollectSafety(collapsed.existing, collapsed.incoming).status).toBe("REVIEW");
  });

  it("reviews catastrophic collapse before merge", () => {
    const host = createMemoryHost({
      collect: {
        existing: { label: "free-people-production", productCount: 1000, valid: true },
        incoming: { label: "free-people-staging", productCount: 400, valid: true },
      },
    });
    const result = authorizeAndExecuteGitHubIssue(payload(), host);
    expect(result.status).toBe("REVIEW");
    expect(result.failedGate).toBe("collect-safety");
    expect(host.calls.commits).toBe(0);
    expect(host.calls.commands.some((argv) => argv.includes("merge:free-people-staging"))).toBe(false);
    expect(
      evaluateHandlerCollectSafety(
        { label: "valid", productCount: 1000, valid: true },
        { label: "collapsed", productCount: 400, valid: true },
      ).status,
    ).toBe("REVIEW");
  });

  it("does not commit after merge when a derived rebuild fails", () => {
    const host = createMemoryHost({ failCommand: "npm run analyze:multibrand" });
    const result = authorizeAndExecuteGitHubIssue(payload(), host);
    expect(result.status).toBe("FAILED");
    expect(host.calls.commands.some((argv) => argv.includes("merge:free-people-staging"))).toBe(true);
    expect(host.calls.commands.some((argv) => argv.includes("build:model-families"))).toBe(false);
    expect(host.calls.commits).toBe(0);
    expect(host.calls.pushes).toHaveLength(0);
    expect(host.calls.prCreates).toBe(0);
  });

  it("blocks an unexpected derived file", () => {
    const host = createMemoryHost({
      changedPaths: [
        "data/multibrand/products.json",
        "data/multibrand/taxonomy-vision-cache.json",
      ],
    });
    const result = authorizeAndExecuteGitHubIssue(payload(), host);
    expect(result.status).toBe("BLOCKED");
    expect(result.failedGate).toBe("mutation-allowlist");
    expect(host.calls.commits).toBe(0);
  });

  it("does not commit after a failed test", () => {
    const host = createMemoryHost({ failCommand: "npm test" });
    const result = authorizeAndExecuteGitHubIssue(payload(), host);
    expect(result.status).toBe("FAILED");
    expect(result.failedGate).toBe("test");
    expect(result.tests).toBe("FAIL");
    expect(host.calls.commits).toBe(0);
  });

  it("does not commit after a failed build", () => {
    const host = createMemoryHost({ failCommand: "npm run build" });
    const result = authorizeAndExecuteGitHubIssue(payload(), host);
    expect(result.status).toBe("FAILED");
    expect(result.failedGate).toBe("build");
    expect(result.build).toBe("FAIL");
    expect(host.calls.commits).toBe(0);
  });

  it("stages only allowlisted paths on success", () => {
    const host = createMemoryHost({
      changedPaths: ["data/multibrand/products.json", "data/registry/marketplace-pilot.json"],
    });
    const result = authorizeAndExecuteGitHubIssue(payload(), host);
    expect(result.status).toBe("READY");
    expect(host.calls.staged[0]).toEqual([
      "data/multibrand/products.json",
      "data/registry/marketplace-pilot.json",
    ]);
    expect(host.calls.staged.flat()).not.toContain(".");
    expect(() => stageExactArgv(["."])).toThrow(/forbidden/i);
  });
});

describe("Phase 2B model-family shard allowlist", () => {
  it("accepts a deleted stale shard and blocks other files in that directory", () => {
    const deleted = parseGitStatusShort(" D data/multibrand/model-families/part-006.json");
    expect(deleted).toEqual(["data/multibrand/model-families/part-006.json"]);
    expect(isFreePeopleModelFamilyOutput(deleted[0]!)).toBe(true);
    expect(unexpectedHandlerPaths(deleted, PRODUCT_RESEARCH_FREE_PEOPLE_REFRESH)).toEqual([]);

    expect(
      unexpectedHandlerPaths(
        [
          "data/multibrand/model-families/foo.json",
          "data/multibrand/model-families/part-00a.json",
          "data/multibrand/model-families/random.txt",
        ],
        PRODUCT_RESEARCH_FREE_PEOPLE_REFRESH,
      ),
    ).toEqual([
      "data/multibrand/model-families/foo.json",
      "data/multibrand/model-families/part-00a.json",
      "data/multibrand/model-families/random.txt",
    ]);

    const argv = stageExactArgv(deleted);
    expect(argv).toEqual(["git", "add", "--", "data/multibrand/model-families/part-006.json"]);
    expect(argv).not.toContain(".");

    const host = createMemoryHost({
      changedPaths: ["data/multibrand/products.json", "data/multibrand/model-families/part-006.json"],
    });
    const result = authorizeAndExecuteGitHubIssue(payload(), host);
    expect(result.status).toBe("READY");
    expect(host.calls.staged[0]).toEqual([
      "data/multibrand/products.json",
      "data/multibrand/model-families/part-006.json",
    ]);
    expect(host.calls.staged.flat()).not.toContain(".");
  });
});

describe("Phase 2B Free People end-to-end handler", () => {
  it("runs the derived catalog pipeline and stages only owned tracked outputs", () => {
    const changedPaths = [
      "data/multibrand/products.json",
      "data/registry/marketplace-pilot.json",
      "data/multibrand/analyzed-products.json",
      "data/multibrand/market-analysis.json",
      "data/multibrand/model-families/manifest.json",
      "data/multibrand/model-families/part-000.json",
      "data/multibrand/model-family-report.json",
      "data/multibrand/taxonomy-qa-report.json",
      "data/multibrand/taxonomy-qa-samples.json",
      "data/onboarding/staging/free-people/products.json",
    ];
    const host = createMemoryHost({
      collect: {
        existing: { label: "free-people-production", productCount: 900, valid: true },
        incoming: { label: "free-people-staging", productCount: 980, valid: true },
      },
      changedPaths,
    });
    const result = authorizeAndExecuteGitHubIssue(payload(), host);
    expect(result.status).toBe("READY");
    expect(host.calls.commands.map((argv) => argv.join(" "))).toEqual([
      "npm run collect:free-people-staging",
      "npm run merge:free-people-staging",
      "npm run analyze:multibrand",
      "npm run build:model-families",
      "npm run taxonomy:qa",
      "npm run operator:test",
      "npm test",
      "npx tsc -b --pretty false",
      "npm run build",
      "git diff --check",
    ]);
    expect(host.calls.staged[0]).toEqual([
      "data/multibrand/products.json",
      "data/registry/marketplace-pilot.json",
      "data/multibrand/analyzed-products.json",
      "data/multibrand/market-analysis.json",
      "data/multibrand/model-families/manifest.json",
      "data/multibrand/model-families/part-000.json",
      "data/multibrand/model-family-report.json",
      "data/multibrand/taxonomy-qa-report.json",
      "data/multibrand/taxonomy-qa-samples.json",
    ]);
    expect(host.calls.staged.flat()).not.toContain("data/onboarding/staging/free-people/products.json");
    expect(host.calls.staged.flat()).not.toContain(".");
    expect(host.calls.commits).toBe(1);
    expect(host.calls.pushes[0]).toEqual(["git", "push", "-u", "origin", "operator/issue-12"]);
    expect(result.pullRequestNumber).toBe(44);
  });
});

describe("Phase 2B pull request and comment", () => {
  it("always bases the PR on main and never auto-merges", () => {
    const host = createMemoryHost();
    const result = authorizeAndExecuteGitHubIssue(payload(), host);
    expect(result.status).toBe("READY");
    expect(result.pullRequestNumber).toBe(44);
    expect(result.comment).toContain(OPERATOR_REPORT_MARKER);
    expect(result.comment).toContain("operator/issue-12");
  });

  it("reuses the same Operator Issue comment on rerun", () => {
    const host = createMemoryHost();
    const first = authorizeAndExecuteGitHubIssue(payload(), host);
    const second = authorizeAndExecuteGitHubIssue(payload(), host);
    expect(first.comment).toContain(OPERATOR_REPORT_MARKER);
    expect(second.comment).toContain(OPERATOR_REPORT_MARKER);
    const existing = findExistingOperatorComment([
      { id: 1, body: "unrelated" },
      { id: 2, body: first.comment },
    ]);
    expect(existing?.id).toBe(2);
    expect(formatExecutionIssueComment(second, second.taskId ? createJobManifest({
      rawInstruction: "Free People ürünlerini güncelle",
      id: second.taskId,
    }) : null)).toContain(OPERATOR_REPORT_MARKER);
  });

  it("does not create a duplicate PR on rerun", () => {
    const existingPr: ExistingPullRequest = {
      number: 44,
      url: "https://github.com/ersin/CAPONE_OPERATOR/pull/44",
      base: "main",
      head: "operator/issue-12",
      body: `${OPERATOR_PR_MARKER}\nexisting`,
    };
    const host = createMemoryHost({ existingPr });
    const result = authorizeAndExecuteGitHubIssue(payload(), host);
    expect(result.pullRequestNumber).toBe(44);
    expect(host.calls.prCreates).toBe(0);
    expect(host.calls.prUpdates).toBe(1);
    expect(findExistingOperatorPr([{ number: 9, body: "other" }, { number: 44, body: existingPr.body }])?.number).toBe(
      44,
    );
  });

  it("creates no PR when execution has no repository changes", () => {
    const host = createMemoryHost({ changedPaths: [] });
    const qa = authorizeAndExecuteGitHubIssue(
      payload({ issue: { title: "Katalog QA" } }),
      host,
    );
    expect(resolveExecutorHandler(createJobManifest({ rawInstruction: "Katalog QA" }))?.id).toBe("safe-operator-qa");
    expect(qa.status).toBe("NO_CHANGES");
    expect(qa.pullRequestNumber).toBeNull();
    expect(host.calls.commits).toBe(0);
    expect(host.calls.prCreates).toBe(0);
  });
});

describe("Phase 2B isolation and workflow contract", () => {
  it("keeps Product Research and Market Research isolated", () => {
    const product = parseOperatorIntake("Free People ürünlerini güncelle");
    const market = parseOperatorIntake("Romanya Pazar Araştırmasına Botta ekle");
    expect(product.domain).toBe("PRODUCT_RESEARCH");
    expect(product.destination).toBe("PAZARYERLERI");
    expect(market.domain).toBe("MARKET_RESEARCH");
    expect(market.template).not.toMatch(/^PRODUCT_RESEARCH/);
    expect(
      resolveExecutorHandler(createJobManifest({ rawInstruction: "Romanya Pazar Araştırmasına Botta ekle" })),
    ).toBeNull();
    expect(
      unsupportedHandlerReason(createJobManifest({ rawInstruction: "Romanya Pazar Araştırmasına Botta ekle" })),
    ).toMatch(/Market Research/);
    const planned = processGitHubIssuePayload(
      payload({ issue: { title: "Romanya Pazar Araştırmasına Botta ekle" } }),
    );
    expect(planned.job?.domain).toBe("MARKET_RESEARCH");
    expect(formatGitHubIssueComment(planned.job!)).toContain("Pazar Araştırması");
  });

  it("keeps the execute workflow free of deployments permission and issue-text shell interpolation", () => {
    const yaml = readFileSync(
      resolve(process.cwd(), ".github/workflows/capone-operator-execute.yml"),
      "utf-8",
    );
    expect(yaml).toContain("contents: write");
    expect(yaml).toContain("issues: write");
    expect(yaml).toContain("pull-requests: write");
    expect(yaml).not.toMatch(/deployments:\s*write/);
    expect(yaml).not.toMatch(/actions:\s*write/);
    expect(yaml).not.toMatch(/packages:\s*write/);
    expect(yaml).not.toContain("${{ github.event.issue.title }}");
    expect(yaml).not.toContain("${{ github.event.issue.body }}");
    expect(yaml).toContain("capone-operator-execute-${{ github.event.issue.number }}");
    expect(yaml).toContain("capone-execute");
    expect(yaml).toContain("operator:execute-github-issue");
  });

  it("writes a small artifact without secrets", () => {
    const host = createMemoryHost();
    const result = authorizeAndExecuteGitHubIssue(payload(), host);
    const artifact = toExecutionArtifact(result);
    expect(artifact.status).toBe("READY");
    expect(artifact.baseSha).toBe("038a2f6c3e36ce30ca0d5d6a11709463a931ad96");
    expect(artifactContainsForbiddenKey(artifact)).toBe(false);
    expect(JSON.stringify(artifact)).not.toMatch(/github_token|ghs_/i);
  });
});
