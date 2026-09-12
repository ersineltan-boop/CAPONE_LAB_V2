import { DEFAULT_APPROVAL_DECISIONS } from "../constants";
import type { ApprovalDecision, ApprovalGate, OwnerApproval, SafetyGateSummary } from "../types";
import { APPROVAL_GATES } from "../types";

export function defaultDecisionFor(gate: ApprovalGate): ApprovalDecision {
  return DEFAULT_APPROVAL_DECISIONS[gate];
}

export function isOwnerApproved(gate: ApprovalGate, approval?: OwnerApproval | null): boolean {
  if (!approval) return false;
  return approval.gates.includes(gate) && Boolean(approval.approvedBy?.trim());
}

export function evaluateApproval(
  gate: ApprovalGate,
  approval?: OwnerApproval | null,
): { allowed: boolean; decision: ApprovalDecision; reason: string } {
  if (isOwnerApproved(gate, approval)) {
    return {
      allowed: true,
      decision: "ALLOW",
      reason: `Owner approved ${gate}`,
    };
  }
  return {
    allowed: false,
    decision: "DENY",
    reason: `${gate} defaults to DENY unless the owner explicitly approves it`,
  };
}

export function requireProductionActionApproval(
  gate: ApprovalGate,
  approval?: OwnerApproval | null,
): void {
  const result = evaluateApproval(gate, approval);
  if (!result.allowed) {
    throw new Error(result.reason);
  }
}

export function summarizeSafetyGates(approval?: OwnerApproval | null): SafetyGateSummary[] {
  return APPROVAL_GATES.map((gate) => {
    const result = evaluateApproval(gate, approval);
    return {
      gate,
      defaultDecision: defaultDecisionFor(gate),
      ownerApproved: isOwnerApproved(gate, approval),
      allowed: result.allowed,
    };
  });
}

export function productionActionsDeniedByDefault(): boolean {
  return APPROVAL_GATES.every((gate) => defaultDecisionFor(gate) === "DENY");
}
