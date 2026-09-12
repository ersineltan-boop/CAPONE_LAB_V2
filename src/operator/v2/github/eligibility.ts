import { OPERATOR_ISSUE_LABEL } from "./constants";
import type { GitHubIssuePayload } from "./payload";

export function hasOperatorLabel(labels: readonly string[]): boolean {
  return labels.some((label) => label.trim().toLowerCase() === OPERATOR_ISSUE_LABEL);
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
