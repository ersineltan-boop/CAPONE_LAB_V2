import { OPERATOR_EXECUTE_LABEL, OPERATOR_ISSUE_LABEL } from "./constants";
import type { GitHubIssuePayload } from "./payload";

export function hasOperatorLabel(labels: readonly string[]): boolean {
  return labels.some((label) => label.trim().toLowerCase() === OPERATOR_ISSUE_LABEL);
}

export function hasExecuteLabel(labels: readonly string[]): boolean {
  return labels.some((label) => label.trim().toLowerCase() === OPERATOR_EXECUTE_LABEL);
}

export function isEligibleGitHubIssue(payload: GitHubIssuePayload): {
  eligible: boolean;
  reason: string;
} {
  if (payload.eventName !== "issues") {
    return { eligible: false, reason: "Not an issues event" };
  }
  if (payload.issue.pullRequest) {
    return { eligible: false, reason: "Pull requests are not processed as Operator issues" };
  }
  if (!hasOperatorLabel(payload.issue.labels)) {
    return { eligible: false, reason: `Missing required label: ${OPERATOR_ISSUE_LABEL}` };
  }
  return { eligible: true, reason: "Labeled GitHub Issue is eligible" };
}

export function isEligibleForExecution(payload: GitHubIssuePayload): {
  eligible: boolean;
  reason: string;
} {
  const intake = isEligibleGitHubIssue(payload);
  if (!intake.eligible) return intake;
  if (!hasExecuteLabel(payload.issue.labels)) {
    return {
      eligible: false,
      reason: `Execution requires both ${OPERATOR_ISSUE_LABEL} and ${OPERATOR_EXECUTE_LABEL}`,
    };
  }
  return { eligible: true, reason: "Issue is authorized for Phase 2B execution" };
}
