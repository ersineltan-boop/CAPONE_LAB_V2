import type { JobManifest } from "../types";
import { FREE_PEOPLE_REFRESH_EXACT_PATHS, FREE_PEOPLE_REFRESH_PATH_PREFIXES } from "./paths";
import type { ExecutorHandler, HandlerCommand } from "./types";

function argvKey(argv: readonly string[]): string {
  return argv.join("\0");
}

function targetLooksLikeFreePeople(job: JobManifest): boolean {
  const name = (job.targetName ?? "").trim().toLowerCase();
  return name === "free people" || name === "free-people";
}

export const COLLECT_FREE_PEOPLE_STAGING: HandlerCommand = {
  argv: ["npm", "run", "collect:free-people-staging"],
  kind: "collect",
};

export const MERGE_FREE_PEOPLE_STAGING: HandlerCommand = {
  argv: ["npm", "run", "merge:free-people-staging"],
  kind: "merge",
};

export const ANALYZE_MULTIBRAND: HandlerCommand = {
  argv: ["npm", "run", "analyze:multibrand"],
  kind: "task",
};

export const BUILD_MODEL_FAMILIES: HandlerCommand = {
  argv: ["npm", "run", "build:model-families"],
  kind: "task",
};

export const TAXONOMY_QA: HandlerCommand = {
  argv: ["npm", "run", "taxonomy:qa"],
  kind: "qa",
};

export const PRODUCT_RESEARCH_FREE_PEOPLE_REFRESH: ExecutorHandler = {
  id: "product-research-free-people-refresh",
  templates: ["PRODUCT_RESEARCH_REFRESH"],
  match(job) {
    return (
      job.template === "PRODUCT_RESEARCH_REFRESH" &&
      job.domain === "PRODUCT_RESEARCH" &&
      job.destination === "PAZARYERLERI" &&
      targetLooksLikeFreePeople(job)
    );
  },
  commands: [
    COLLECT_FREE_PEOPLE_STAGING,
    MERGE_FREE_PEOPLE_STAGING,
    ANALYZE_MULTIBRAND,
    BUILD_MODEL_FAMILIES,
    TAXONOMY_QA,
  ],
  allowedExactPaths: FREE_PEOPLE_REFRESH_EXACT_PATHS,
  allowedPathPrefixes: FREE_PEOPLE_REFRESH_PATH_PREFIXES,
  requiresCollectSafety: true,
};

export const SAFE_OPERATOR_QA: ExecutorHandler = {
  id: "safe-operator-qa",
  templates: ["QA_ONLY", "PRODUCT_RESEARCH_CATALOG_QA"],
  match(job) {
    return job.template === "QA_ONLY" || job.template === "PRODUCT_RESEARCH_CATALOG_QA";
  },
  commands: [],
  allowedExactPaths: [],
  allowedPathPrefixes: [".operator/"],
  requiresCollectSafety: false,
};

export const EXECUTOR_HANDLERS: readonly ExecutorHandler[] = [
  PRODUCT_RESEARCH_FREE_PEOPLE_REFRESH,
  SAFE_OPERATOR_QA,
];

const REGISTERED_COMMAND_KEYS = new Set(
  EXECUTOR_HANDLERS.flatMap((handler) => handler.commands.map((command) => argvKey(command.argv))),
);

export function resolveExecutorHandler(job: JobManifest): ExecutorHandler | null {
  return EXECUTOR_HANDLERS.find((handler) => handler.match(job)) ?? null;
}

export function isRegisteredHandlerCommand(argv: readonly string[]): boolean {
  return REGISTERED_COMMAND_KEYS.has(argvKey(argv));
}

export function handlerOwnsCommand(handler: ExecutorHandler, argv: readonly string[]): boolean {
  const key = argvKey(argv);
  return handler.commands.some((command) => argvKey(command.argv) === key);
}

export function unsupportedHandlerReason(job: JobManifest): string {
  if (job.template.startsWith("MARKET_RESEARCH")) {
    return "UNSUPPORTED_HANDLER: Market Research is not executable in Phase 2B";
  }
  if (job.template === "PRODUCT_RESEARCH_BRAND_ONBOARDING") {
    return "UNSUPPORTED_HANDLER: Brand onboarding has no safe Phase 2B handler";
  }
  if (job.template === "PRODUCT_RESEARCH_MARKETPLACE_ONBOARDING") {
    return "UNSUPPORTED_HANDLER: Marketplace onboarding has no safe Phase 2B handler";
  }
  if (
    job.template === "PRODUCT_RESEARCH_REFRESH" &&
    !targetLooksLikeFreePeople(job)
  ) {
    return "UNSUPPORTED_HANDLER: Only Free People Pazaryerleri refresh is executable";
  }
  return `UNSUPPORTED_HANDLER: ${job.template} has no safe Phase 2B handler`;
}
