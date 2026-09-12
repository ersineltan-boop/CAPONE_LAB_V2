import { GITHUB_ISSUE_ACTIONS } from "./constants";
import type { GitHubIssueAction } from "./constants";

export interface GitHubIssuePayload {
  eventName: string;
  action: string;
  repository: string;
  issue: {
    number: number;
    title: string;
    body: string;
    user: string;
    htmlUrl: string;
    createdAt: string;
    labels: string[];
    pullRequest: boolean;
  };
}

export type PayloadValidation =
  | { ok: true; payload: GitHubIssuePayload }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asLabels(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const labels: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      labels.push(item);
      continue;
    }
    if (isRecord(item) && typeof item.name === "string") {
      labels.push(item.name);
      continue;
    }
    return null;
  }
  return labels;
}

export function validateGitHubIssuePayload(raw: unknown): PayloadValidation {
  if (!isRecord(raw)) {
    return { ok: false, reason: "Payload is not a JSON object" };
  }

  const eventName = asString(raw.eventName);
  if (!eventName) {
    return { ok: false, reason: "Missing eventName" };
  }
  if (eventName === "pull_request" || eventName.startsWith("pull_request")) {
    return { ok: false, reason: "Pull request events are rejected" };
  }
  if (eventName !== "issues") {
    return { ok: false, reason: `Unsupported eventName: ${eventName}` };
  }

  const action = asString(raw.action);
  if (!action) {
    return { ok: false, reason: "Missing action" };
  }
  if (!(GITHUB_ISSUE_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, reason: `Unsupported issue action: ${action}` };
  }

  const repository = asString(raw.repository);
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
    return { ok: false, reason: "repository must be owner/name" };
  }

  if (!isRecord(raw.issue)) {
    return { ok: false, reason: "Missing issue object" };
  }

  const number = raw.issue.number;
  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) {
    return { ok: false, reason: "issue.number must be a positive integer" };
  }

  const title = asString(raw.issue.title);
  const body = asString(raw.issue.body);
  const user = asString(raw.issue.user);
  const htmlUrl = asString(raw.issue.htmlUrl);
  const createdAt = asString(raw.issue.createdAt);
  const labels = asLabels(raw.issue.labels);
  if (title === null || body === null || !user || !htmlUrl || !createdAt || !labels) {
    return { ok: false, reason: "Issue metadata fields are missing or invalid" };
  }

  return {
    ok: true,
    payload: {
      eventName,
      action: action as GitHubIssueAction,
      repository,
      issue: {
        number,
        title,
        body,
        user,
        htmlUrl,
        createdAt,
        labels,
        pullRequest: raw.issue.pullRequest === true,
      },
    },
  };
}

export function parseGitHubIssuePayloadJson(text: string): PayloadValidation {
  try {
    return validateGitHubIssuePayload(JSON.parse(text) as unknown);
  } catch {
    return { ok: false, reason: "Payload is not valid JSON" };
  }
}
