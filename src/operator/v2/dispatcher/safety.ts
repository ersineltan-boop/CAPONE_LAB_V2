import type { Blocker } from "../../types";
import { PRODUCTION_DATA_PREFIXES } from "../storage/paths";
import type { DispatcherTask } from "./types";

export const PHASE_3A_SAFETY = {
  mobileUi: false,
  productionMutation: false,
  newLiveCollectors: false,
  automaticMerge: false,
  automaticDeploy: false,
  preservesPhase2AGates: true,
  preservesPhase2BGates: true,
  invokesPhase2BExecutor: false,
} as const;

export type Phase3AForbiddenAction =
  | "PRODUCTION_MUTATION"
  | "LIVE_COLLECTOR"
  | "AUTO_MERGE"
  | "AUTO_DEPLOY"
  | "MOBILE_UI";

export function phase3AForbids(_action: Phase3AForbiddenAction): true {
  return true;
}

export function phase3AInvokesPhase2BExecutor(): false {
  return PHASE_3A_SAFETY.invokesPhase2BExecutor;
}

export function dispatcherTouchesProductionData(paths: readonly string[]): string[] {
  return paths.filter((path) =>
    PRODUCTION_DATA_PREFIXES.some((prefix) => path.replace(/\\/g, "/").startsWith(prefix)),
  );
}

export function validateDispatcherSafety(task: DispatcherTask): Blocker[] {
  const blockers: Blocker[] = [];
  if (task.productionDataModified) {
    blockers.push({
      code: "PHASE_3A_PRODUCTION_MUTATION",
      reason: "Phase 3A dispatcher must not mutate production data",
      severity: "BLOCKED",
    });
  }
  if (task.liveCollectorStarted) {
    blockers.push({
      code: "PHASE_3A_LIVE_COLLECTOR",
      reason: "Phase 3A dispatcher must not start live collectors",
      severity: "BLOCKED",
    });
  }
  if (task.autoMerge) {
    blockers.push({
      code: "PHASE_3A_AUTO_MERGE",
      reason: "Phase 3A dispatcher must not merge pull requests",
      severity: "BLOCKED",
    });
  }
  if (task.autoDeploy) {
    blockers.push({
      code: "PHASE_3A_AUTO_DEPLOY",
      reason: "Phase 3A dispatcher must not deploy to production",
      severity: "BLOCKED",
    });
  }
  return blockers;
}

export function phase3ACompletionState(task: DispatcherTask): "DONE" | "REVIEW" | "BLOCKED" {
  const safety = validateDispatcherSafety(task);
  if (safety.length > 0 || task.route.action === "BLOCK") return "BLOCKED";
  if (task.route.action === "DRY_SAFE") return "DONE";
  return "REVIEW";
}
