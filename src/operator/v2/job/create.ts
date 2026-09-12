import { buildExecutionPlan } from "../plan/builder";
import { parseOperatorIntake } from "../intake/parse";
import { APPROVAL_GATES } from "../../types";
import type { ExecutionMode, GitHubIssueRef, JobManifest, TaskSource } from "../types";
import { collectedAtDoesNotImplyNewArrival } from "../../policies/onboardingQuality";
import { visualMayDeduplicateAcrossSources } from "../../policies/domains";
import { canReplaceExistingDataset } from "../../policies/collectSafety";

function slugPart(value: string | null): string {
  return (value ?? "task")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "task";
}

export function createJobId(instruction: string, now = new Date()): string {
  return `job-${now.getTime()}-${slugPart(instruction)}`;
}

export function createJobManifest(input: {
  rawInstruction: string;
  requestedBy?: string;
  source?: TaskSource;
  executionMode?: ExecutionMode;
  now?: Date;
  id?: string;
  githubIssue?: GitHubIssueRef | null;
}): JobManifest {
  const now = input.now ?? new Date();
  const iso = now.toISOString();
  const parsed = parseOperatorIntake(input.rawInstruction);
  const steps = buildExecutionPlan(parsed);
  const ownerResult = parsed.injectionAttempt
    ? "BLOCKED"
    : parsed.ambiguous || !parsed.domain
      ? "REVIEW"
      : "REVIEW";

  const visual = visualMayDeduplicateAcrossSources([
    {
      productKey: parsed.targetName ?? "sample",
      sourceKind: "BRAND",
      sourceId: "brand",
      sourceUrl: "https://brand.example/p",
    },
    {
      productKey: parsed.targetName ?? "sample",
      sourceKind: "MARKETPLACE",
      sourceId: "marketplace",
      sourceUrl: "https://marketplace.example/p",
    },
  ]);

  return {
    id: input.id ?? createJobId(input.rawInstruction, now),
    createdAt: iso,
    updatedAt: iso,
    requestedBy: input.requestedBy ?? "owner",
    source: input.source ?? "LOCAL_CLI",
    rawInstruction: input.rawInstruction,
    parsedIntent: parsed,
    domain: parsed.domain,
    template: parsed.template,
    targetName: parsed.targetName,
    targetType: parsed.targetType,
    destination: parsed.destination,
    salesMarket: parsed.salesMarket,
    sourceUrls: parsed.sourceUrls,
    state: ownerResult === "BLOCKED" ? "BLOCKED" : "QUEUED",
    ownerResult,
    executionMode: input.executionMode ?? "LOCAL_SAFE",
    approvalRequirements: [...APPROVAL_GATES],
    steps,
    artifacts: [],
    blockers: parsed.injectionAttempt
      ? [{ code: "SHELL_INJECTION", reason: parsed.reason, severity: "BLOCKED" }]
      : parsed.ambiguous
        ? [{ code: "AMBIGUOUS_TASK", reason: parsed.reason, severity: "REVIEW" }]
        : [],
    qa: {
      domainIsolated: parsed.domain !== null && !parsed.ambiguous,
      newArrivalUsesSourceEvidence: collectedAtDoesNotImplyNewArrival(iso),
      visualKeepsMarketplaceProvenance: visual.sourcesPreserved.length === 2,
      emptyCollectProtected: !canReplaceExistingDataset(
        { label: "existing", productCount: 10, valid: true },
        { label: "incoming", productCount: 0, valid: false },
      ).allowed,
      notes: [
        "Phase 1 does not write production datasets",
        "Live collectors are not wired",
      ],
    },
    timestamps: {
      queuedAt: iso,
      startedAt: null,
      finishedAt: null,
    },
    why: parsed.reason,
    productionDataModified: false,
    githubIssue: input.githubIssue ?? null,
  };
}
