import { canAuthorizePhase2BExecution } from "../executor/authorization";
import { createJobManifest } from "../job/create";
import type { JobManifest, V2TemplateId } from "../types";
import { getDispatcherCatalogEntry } from "./catalog";
import { buildLockKeys } from "./conflicts";
import type {
  DispatcherDomain,
  DispatcherPriority,
  DispatcherRisk,
  DispatcherRoute,
  DispatcherState,
  DispatcherTask,
} from "./types";

const UI_APP_SIGNAL =
  /\bui[_ -]?app\b|\bfrontend\b|\blayout\b|\bcomponent\b|\bcss\b|\bvite\b|aray[uü]z|sayfa/i;
const BUGFIX_SIGNAL = /\bbugfix\b|\bbug[ -]?fix\b|\bbug\b|hata\s+d[uü]zelt|\bfix:/i;
const V2_RESOLVED_SIGNAL =
  /g[uü]ncelle|yenile|refresh|markalar['']?a\s+ekle|pazar ara[sş]t[iı]rm|pazaryer.*ekle/i;

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "task";
}

export function createDispatcherId(instruction: string, now = new Date()): string {
  return `disp-${now.getTime()}-${slugPart(instruction)}`;
}

export function looksLikeUiApp(instruction: string): boolean {
  return UI_APP_SIGNAL.test(instruction) && !V2_RESOLVED_SIGNAL.test(instruction);
}

export function looksLikeBugfix(instruction: string): boolean {
  return BUGFIX_SIGNAL.test(instruction) && !V2_RESOLVED_SIGNAL.test(instruction);
}

export function dispatcherDomainFromV2(
  job: Pick<JobManifest, "template" | "destination" | "domain">,
): DispatcherDomain {
  if (job.template === "PRODUCT_RESEARCH_CATALOG_QA" || job.template === "QA_ONLY") {
    return "CATALOG_QA";
  }
  if (
    job.template === "PRODUCT_RESEARCH_MARKETPLACE_ONBOARDING" ||
    (job.template === "PRODUCT_RESEARCH_REFRESH" && job.destination === "PAZARYERLERI")
  ) {
    return "MARKETPLACE_REFRESH";
  }
  if (job.template.startsWith("MARKET_RESEARCH") || job.domain === "MARKET_RESEARCH") {
    return "MARKET_RESEARCH";
  }
  return "PRODUCT_RESEARCH";
}

export function classifyDispatcherDomain(
  instruction: string,
  job: JobManifest,
): DispatcherDomain {
  if (!job.parsedIntent.ambiguous && job.domain && !job.parsedIntent.injectionAttempt) {
    return dispatcherDomainFromV2(job);
  }
  if (looksLikeBugfix(instruction)) return "BUGFIX";
  if (looksLikeUiApp(instruction)) return "UI_APP";
  if (job.domain || job.template !== "AMBIGUOUS_REVIEW") {
    return dispatcherDomainFromV2(job);
  }
  return "PRODUCT_RESEARCH";
}

function routeForTask(input: {
  domain: DispatcherDomain;
  job: JobManifest;
}): DispatcherRoute {
  if (input.job.parsedIntent.injectionAttempt || input.job.ownerResult === "BLOCKED") {
    return {
      action: "BLOCK",
      phase2bEligible: false,
      existingHandlerId: null,
      reason: input.job.why,
    };
  }

  if (input.domain === "CATALOG_QA") {
    return {
      action: "DRY_SAFE",
      phase2bEligible: false,
      existingHandlerId: null,
      reason: "Catalog QA is inspection-only in Phase 3A; no production write or collector",
    };
  }

  if (input.domain === "MARKETPLACE_REFRESH") {
    const auth = canAuthorizePhase2BExecution(input.job);
    if (auth.ok) {
      return {
        action: "HOLD_FOR_PHASE_2B",
        phase2bEligible: true,
        existingHandlerId: auth.handler.id,
        reason:
          "Existing Phase 2B handler is eligible; Phase 3A queues only and does not execute collect/merge/deploy",
      };
    }
  }

  return {
    action: "OWNER_REVIEW",
    phase2bEligible: false,
    existingHandlerId: null,
    reason:
      input.job.parsedIntent.ambiguous || !input.job.domain
        ? input.job.why
        : `${input.domain} stays in REVIEW — Phase 3A does not mutate production, start collectors, or merge/deploy`,
  };
}

function initialState(route: DispatcherRoute): DispatcherState {
  if (route.action === "BLOCK") return "BLOCKED";
  if (route.action === "OWNER_REVIEW") return "REVIEW";
  return "READY";
}

function ownerResultFor(state: DispatcherState): DispatcherTask["ownerResult"] {
  if (state === "BLOCKED") return "BLOCKED";
  if (state === "FAILED") return "FAILED";
  if (state === "DONE") return "PASS";
  return "REVIEW";
}

function titleFor(domain: DispatcherDomain, targetName: string | null, instruction: string): string {
  if (targetName) return `${domain}: ${targetName}`;
  return instruction.trim().slice(0, 80) || domain;
}

export function createDispatcherTask(input: {
  instruction: string;
  now?: Date;
  id?: string;
  job?: JobManifest;
}): DispatcherTask {
  const now = input.now ?? new Date();
  const iso = now.toISOString();
  const job =
    input.job ??
    createJobManifest({
      rawInstruction: input.instruction,
      now,
    });
  const domain = classifyDispatcherDomain(input.instruction, job);
  const catalog = getDispatcherCatalogEntry(domain);
  const risk: DispatcherRisk =
    job.parsedIntent.injectionAttempt ? "CRITICAL" : catalog.risk;
  const priority: DispatcherPriority = catalog.priority;
  const route = routeForTask({ domain, job });
  const state = initialState(route);
  const targetName = job.targetName;
  const targetFiles = [...catalog.defaultFiles];
  const lockKeys = buildLockKeys({ domain, targetName, targetFiles });
  const v2Template: V2TemplateId | null =
    domain === "UI_APP" || domain === "BUGFIX" ? null : job.template;

  return {
    id: input.id ?? createDispatcherId(input.instruction, now),
    createdAt: iso,
    updatedAt: iso,
    title: titleFor(domain, targetName, input.instruction),
    instruction: input.instruction,
    domain,
    template: catalog.template,
    v2Template,
    v2JobId: job.id,
    state,
    priority,
    risk,
    targetName,
    targetFiles,
    lockKeys,
    route,
    ownerResult: ownerResultFor(state),
    blockers: job.blockers.map((item) => ({ ...item })),
    why: route.reason,
    productionDataModified: false,
    liveCollectorStarted: false,
    autoMerge: false,
    autoDeploy: false,
    timestamps: {
      queuedAt: iso,
      startedAt: null,
      finishedAt: null,
    },
  };
}

export function createDispatcherTaskFromSpec(input: {
  domain: DispatcherDomain;
  instruction?: string;
  title?: string;
  targetName?: string | null;
  targetFiles?: string[];
  priority?: DispatcherPriority;
  risk?: DispatcherRisk;
  state?: DispatcherState;
  id?: string;
  now?: Date;
  v2JobId?: string | null;
  v2Template?: V2TemplateId | null;
  why?: string;
}): DispatcherTask {
  const now = input.now ?? new Date();
  const iso = now.toISOString();
  const catalog = getDispatcherCatalogEntry(input.domain);
  const instruction = input.instruction ?? `${input.domain} task`;
  const job = createJobManifest({ rawInstruction: instruction, now });
  const route = routeForTask({
    domain: input.domain,
    job,
  });
  const state = input.state ?? initialState(route);
  const targetName = input.targetName ?? job.targetName;
  const targetFiles = input.targetFiles ?? [...catalog.defaultFiles];
  return {
    id: input.id ?? createDispatcherId(instruction, now),
    createdAt: iso,
    updatedAt: iso,
    title: input.title ?? titleFor(input.domain, targetName, instruction),
    instruction,
    domain: input.domain,
    template: catalog.template,
    v2Template: input.v2Template ?? (input.domain === "UI_APP" || input.domain === "BUGFIX" ? null : job.template),
    v2JobId: input.v2JobId ?? job.id,
    state,
    priority: input.priority ?? catalog.priority,
    risk: input.risk ?? catalog.risk,
    targetName,
    targetFiles,
    lockKeys: buildLockKeys({ domain: input.domain, targetName, targetFiles }),
    route: input.state === "BLOCKED"
      ? { ...route, action: "BLOCK", reason: input.why ?? route.reason }
      : route,
    ownerResult: ownerResultFor(state),
    blockers:
      state === "BLOCKED"
        ? [{ code: "DISPATCHER_BLOCKED", reason: input.why ?? route.reason, severity: "BLOCKED" }]
        : [],
    why: input.why ?? route.reason,
    productionDataModified: false,
    liveCollectorStarted: false,
    autoMerge: false,
    autoDeploy: false,
    timestamps: {
      queuedAt: iso,
      startedAt: state === "RUNNING" ? iso : null,
      finishedAt: state === "DONE" || state === "FAILED" || state === "REVIEW" || state === "BLOCKED" ? iso : null,
    },
  };
}
