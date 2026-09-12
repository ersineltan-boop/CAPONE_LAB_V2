import { createJobManifest } from "../job/create";
import { commandFromUntrustedTaskText } from "../commands/policy";
import type { GitHubIssueRef, JobManifest } from "../types";
import { formatGitHubIssueComment } from "./comment";
import { isEligibleGitHubIssue } from "./eligibility";
import { parseGitHubIssuePayloadJson, validateGitHubIssuePayload } from "./payload";
import type { GitHubIssuePayload } from "./payload";

export interface GitHubIssueProcessResult {
  ignored: boolean;
  blocked: boolean;
  reason: string;
  comment: string | null;
  job: JobManifest | null;
  taskId: string | null;
  productionDataModified: false;
}

function untrustedInstruction(payload: GitHubIssuePayload): string {
  return [payload.issue.title, payload.issue.body].filter((part) => part.trim()).join("\n");
}

export function stableGitHubJobId(repository: string, issueNumber: number): string {
  const repo = repository.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `job-ghi-${repo}-${issueNumber}`;
}

function githubRef(payload: GitHubIssuePayload): GitHubIssueRef {
  return {
    repository: payload.repository,
    issueNumber: payload.issue.number,
    issueTitle: payload.issue.title,
    issueBody: payload.issue.body,
    issueAuthor: payload.issue.user,
    issueUrl: payload.issue.htmlUrl,
    createdAt: payload.issue.createdAt,
    labels: [...payload.issue.labels],
  };
}

function ignored(reason: string): GitHubIssueProcessResult {
  return {
    ignored: true,
    blocked: false,
    reason,
    comment: null,
    job: null,
    taskId: null,
    productionDataModified: false,
  };
}

function blocked(reason: string, job: JobManifest | null = null): GitHubIssueProcessResult {
  return {
    ignored: false,
    blocked: true,
    reason,
    comment: job ? formatGitHubIssueComment(job) : null,
    job,
    taskId: job?.id ?? null,
    productionDataModified: false,
  };
}

export function processGitHubIssuePayload(raw: unknown): GitHubIssueProcessResult {
  const validated = validateGitHubIssuePayload(raw);
  if (!validated.ok) {
    return blocked(validated.reason);
  }

  const eligibility = isEligibleGitHubIssue(validated.payload);
  if (!eligibility.eligible) {
    return ignored(eligibility.reason);
  }

  const instruction = untrustedInstruction(validated.payload);
  try {
    commandFromUntrustedTaskText(instruction);
  } catch {
    // expected — issue text must never become a shell command
  }

  const job = createJobManifest({
    rawInstruction: instruction,
    requestedBy: validated.payload.issue.user,
    source: "GITHUB_ISSUE",
    executionMode: "BACKGROUND_SAFE",
    id: stableGitHubJobId(validated.payload.repository, validated.payload.issue.number),
    githubIssue: githubRef(validated.payload),
  });

  return {
    ignored: false,
    blocked: job.ownerResult === "BLOCKED",
    reason: job.why,
    comment: formatGitHubIssueComment(job),
    job,
    taskId: job.id,
    productionDataModified: false,
  };
}

export function processGitHubIssuePayloadText(text: string): GitHubIssueProcessResult {
  const parsed = parseGitHubIssuePayloadJson(text);
  if (!parsed.ok) {
    return blocked(parsed.reason);
  }
  return processGitHubIssuePayload(parsed.payload);
}
