import type { Blocker, QAResult } from "../../types";
import type { V2TemplateId } from "../types";

export const DISPATCHER_DOMAINS = [
  "PRODUCT_RESEARCH",
  "MARKETPLACE_REFRESH",
  "MARKET_RESEARCH",
  "CATALOG_QA",
  "UI_APP",
  "BUGFIX",
] as const;

export type DispatcherDomain = (typeof DISPATCHER_DOMAINS)[number];

export const DISPATCHER_TEMPLATE_IDS = DISPATCHER_DOMAINS;

export type DispatcherTemplateId = DispatcherDomain;

export const DISPATCHER_STATES = [
  "READY",
  "RUNNING",
  "REVIEW",
  "BLOCKED",
  "FAILED",
  "DONE",
] as const;

export type DispatcherState = (typeof DISPATCHER_STATES)[number];

export const DISPATCHER_PRIORITIES = ["P0", "P1", "P2", "P3"] as const;

export type DispatcherPriority = (typeof DISPATCHER_PRIORITIES)[number];

export const DISPATCHER_RISKS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type DispatcherRisk = (typeof DISPATCHER_RISKS)[number];

export const DISPATCHER_ROUTE_ACTIONS = [
  "DRY_SAFE",
  "HOLD_FOR_PHASE_2B",
  "OWNER_REVIEW",
  "BLOCK",
] as const;

export type DispatcherRouteAction = (typeof DISPATCHER_ROUTE_ACTIONS)[number];

export interface DispatcherRoute {
  action: DispatcherRouteAction;
  phase2bEligible: boolean;
  existingHandlerId: string | null;
  reason: string;
}

export interface DispatcherTask {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  instruction: string;
  domain: DispatcherDomain;
  template: DispatcherTemplateId;
  v2Template: V2TemplateId | null;
  v2JobId: string | null;
  state: DispatcherState;
  priority: DispatcherPriority;
  risk: DispatcherRisk;
  targetName: string | null;
  targetFiles: string[];
  lockKeys: string[];
  route: DispatcherRoute;
  ownerResult: QAResult;
  blockers: Blocker[];
  why: string;
  productionDataModified: false;
  liveCollectorStarted: false;
  autoMerge: false;
  autoDeploy: false;
  timestamps: {
    queuedAt: string;
    startedAt: string | null;
    finishedAt: string | null;
  };
}

export interface DispatcherQueueFile {
  version: 3;
  updatedAt: string;
  tasks: DispatcherTask[];
}

export interface DispatcherTickResult {
  queue: DispatcherQueueFile;
  started: string[];
  completed: string[];
  skippedBlocked: string[];
  skippedConflict: string[];
}

export interface DispatcherCatalogEntry {
  domain: DispatcherDomain;
  template: DispatcherTemplateId;
  priority: DispatcherPriority;
  risk: DispatcherRisk;
  defaultFiles: readonly string[];
  writesProduction: false;
  startsLiveCollector: false;
  autoMerge: false;
  autoDeploy: false;
}
