export const OPERATOR_ISSUE_LABEL = "capone-operator";

export const OPERATOR_REPORT_MARKER = "<!-- CAPONE_OPERATOR_REPORT -->";

export const GITHUB_ISSUE_ACTIONS = ["opened", "labeled", "reopened"] as const;

export type GitHubIssueAction = (typeof GITHUB_ISSUE_ACTIONS)[number];
