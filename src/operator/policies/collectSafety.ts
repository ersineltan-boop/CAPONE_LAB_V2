import { evaluateApproval } from "./approval";
import type { CollectDatasetSnapshot, OwnerApproval } from "../types";

export function isFailedOrEmptyCollect(incoming: CollectDatasetSnapshot): boolean {
  return !incoming.valid || incoming.productCount <= 0;
}

export function canReplaceExistingDataset(
  existing: CollectDatasetSnapshot,
  incoming: CollectDatasetSnapshot,
  approval?: OwnerApproval | null,
): { allowed: boolean; reason: string } {
  if (existing.valid && existing.productCount > 0 && isFailedOrEmptyCollect(incoming)) {
    const forced = evaluateApproval("REPLACE_VALID_DATASET_WITH_EMPTY", approval);
    return {
      allowed: forced.allowed,
      reason: forced.allowed
        ? "Owner explicitly approved replacing a valid dataset"
        : `Failed/empty collect cannot replace valid dataset "${existing.label}" (${existing.productCount} products)`,
    };
  }
  if (!incoming.valid) {
    return { allowed: false, reason: `Incoming collect "${incoming.label}" is not valid` };
  }
  return { allowed: true, reason: "Incoming collect may update the dataset" };
}

export function preserveValidDataset(
  existing: CollectDatasetSnapshot,
  incoming: CollectDatasetSnapshot,
  approval?: OwnerApproval | null,
): CollectDatasetSnapshot {
  const decision = canReplaceExistingDataset(existing, incoming, approval);
  return decision.allowed ? incoming : existing;
}
