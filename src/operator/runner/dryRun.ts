import { summarizeSafetyGates } from "../policies/approval";
import { marketResearchForbiddenTargets, productResearchForbiddenTargets } from "../policies";
import { createTaskFromTemplate, getTaskTemplate } from "../templates/definitions";
import type {
  Blocker,
  OperatorTask,
  OwnerApproval,
  PlannedStep,
  QAResult,
  RunMetrics,
  RunSummary,
  TaskTemplateId,
} from "../types";
import { APPROVAL_GATES } from "../types";

export interface DryRunInput {
  templateId: TaskTemplateId;
  title?: string;
  locale?: string | null;
  target?: OperatorTask["target"];
  observations?: Partial<RunMetrics>;
  approval?: OwnerApproval | null;
  now?: Date;
  taskId?: string;
}

const REVIEW_GATES: PlannedStep[] = [
  {
    state: "REVIEW",
    action: "Owner reviews unresolved QA before any production write",
    auto: false,
    requiresOwnerApproval: true,
    approvalGates: [],
  },
  {
    state: "READY",
    action: "Mark ready only after QA PASS and owner approval of production gates",
    auto: false,
    requiresOwnerApproval: true,
    approvalGates: [...APPROVAL_GATES],
  },
];

function emptyMetrics(locale: string | null): RunMetrics {
  return {
    locale,
    products: null,
    models: null,
    groupedColorVariants: null,
    imageCoveragePercent: null,
    unresolvedCategory: 0,
    nonFootwearSuspects: 0,
    tests: "NOT_RUN",
    build: "NOT_RUN",
    discovery: "NOT_RUN",
    collector: "NOT_RUN",
  };
}

function mergeMetrics(locale: string | null, observations?: Partial<RunMetrics>): RunMetrics {
  return { ...emptyMetrics(locale), ...observations, locale: observations?.locale ?? locale };
}

function ownerResult(metrics: RunMetrics, blockers: Blocker[]): QAResult {
  if (blockers.some((blocker) => blocker.severity === "FAILED")) return "FAILED";
  if (blockers.some((blocker) => blocker.severity === "BLOCKED")) return "BLOCKED";
  if (blockers.some((blocker) => blocker.severity === "REVIEW")) return "REVIEW";
  if (metrics.unresolvedCategory > 0 || metrics.nonFootwearSuspects > 0) return "REVIEW";
  return "REVIEW";
}

function dryRunBlockers(task: OperatorTask, metrics: RunMetrics): Blocker[] {
  const blockers: Blocker[] = [
    {
      code: "DRY_RUN_NO_COLLECT",
      reason: "Dry-run only — no collector executed and no production data modified",
      severity: "REVIEW",
    },
  ];

  if (task.domain === "PRODUCT_RESEARCH" && !task.locale && !metrics.locale) {
    blockers.push({
      code: "LOCALE_REQUIRED",
      reason: "Locale is required before locale-sensitive classification",
      severity: "REVIEW",
    });
  }

  if (metrics.unresolvedCategory > 0) {
    blockers.push({
      code: "UNRESOLVED_CATEGORY",
      reason: `${metrics.unresolvedCategory} category classifications need evidence`,
      severity: "REVIEW",
    });
  }

  if (metrics.nonFootwearSuspects > 0) {
    blockers.push({
      code: "NON_FOOTWEAR_SUSPECT",
      reason: `${metrics.nonFootwearSuspects} non-footwear suspects need REVIEW`,
      severity: "REVIEW",
    });
  }

  return blockers;
}

export function runOperatorDryRun(input: DryRunInput): RunSummary {
  const template = getTaskTemplate(input.templateId);
  const now = input.now ?? new Date();
  const task = createTaskFromTemplate(template.id, {
    title: input.title,
    target: input.target,
    locale: input.locale ?? input.observations?.locale ?? null,
    now,
    id: input.taskId,
  });
  const metrics = mergeMetrics(task.locale, input.observations);
  const blockers = dryRunBlockers(task, metrics);
  const status = ownerResult(metrics, blockers);
  const forbidden =
    task.domain === "MARKET_RESEARCH"
      ? marketResearchForbiddenTargets()
      : productResearchForbiddenTargets();

  const why = blockers.map((blocker) => blocker.reason).join("; ");
  const ownerAction = blockers
    .filter((blocker) => blocker.code !== "DRY_RUN_NO_COLLECT")
    .map((blocker) => blocker.reason)
    .join("; ");

  return {
    taskId: task.id,
    taskTitle: task.title,
    domain: task.domain,
    templateId: task.templateId,
    status,
    state: status === "BLOCKED" ? "BLOCKED" : status === "FAILED" ? "FAILED" : "REVIEW",
    steps: [...template.steps, ...REVIEW_GATES],
    metrics,
    blockers,
    qaRequirements: [
      ...template.qaRequirements,
      ...forbidden.map((target) => `Do not write ${target}`),
    ],
    safetyGates: summarizeSafetyGates(input.approval),
    productionReady: false,
    ownerActionRequired: ownerAction || "REVIEW dry-run output before any live collect",
    dryRun: true,
    productionDataModified: false,
    generatedAt: now.toISOString(),
    why,
  };
}
