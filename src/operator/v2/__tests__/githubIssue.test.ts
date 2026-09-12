import { describe, expect, it } from "vitest";

import { OPERATOR_ISSUE_LABEL, OPERATOR_REPORT_MARKER } from "../github/constants";
import {
  commentUsesReportMarker,
  findExistingOperatorComment,
  formatGitHubIssueComment,
} from "../github/comment";
import { hasOperatorLabel, isEligibleGitHubIssue } from "../github/eligibility";
import { processGitHubIssuePayload, processGitHubIssuePayloadText, stableGitHubJobId } from "../github/process";
import { parseGitHubIssuePayloadJson } from "../github/payload";
import { commandFromUntrustedTaskText } from "../commands/policy";
import { pathIsProductionData } from "../guard/mutation";
import type { GitHubIssuePayload } from "../github/payload";

function payload(
  overrides: Partial<Omit<GitHubIssuePayload, "issue">> & {
    issue?: Partial<GitHubIssuePayload["issue"]>;
  } = {},
): GitHubIssuePayload {
  return {
    eventName: overrides.eventName ?? "issues",
    action: overrides.action ?? "opened",
    repository: overrides.repository ?? "ersin/CAPONE_OPERATOR",
    issue: {
      number: overrides.issue?.number ?? 12,
      title: overrides.issue?.title ?? "Massimo Dutti'yi Markalar'a ekle",
      body: overrides.issue?.body ?? "",
      user: overrides.issue?.user ?? "ersin",
      htmlUrl: overrides.issue?.htmlUrl ?? "https://github.com/ersin/CAPONE_OPERATOR/issues/12",
      createdAt: overrides.issue?.createdAt ?? "2026-09-12T15:00:00.000Z",
      labels: overrides.issue?.labels ?? [OPERATOR_ISSUE_LABEL],
      pullRequest: overrides.issue?.pullRequest ?? false,
    },
  };
}

describe("GitHub Issue eligibility", () => {
  it("ignores an unlabeled issue", () => {
    expect(hasOperatorLabel(["bug"])).toBe(false);
    const result = processGitHubIssuePayload(payload({ issue: { labels: ["bug"] } }));
    expect(result.ignored).toBe(true);
    expect(result.job).toBeNull();
    expect(result.comment).toBeNull();
    expect(isEligibleGitHubIssue(payload({ issue: { labels: [] } })).eligible).toBe(false);
  });

  it("accepts a capone-operator labeled issue", () => {
    const result = processGitHubIssuePayload(payload());
    expect(result.ignored).toBe(false);
    expect(result.job?.source).toBe("GITHUB_ISSUE");
    expect(result.job?.githubIssue?.labels).toContain(OPERATOR_ISSUE_LABEL);
  });

  it("rejects a pull request event", () => {
    const parsed = parseGitHubIssuePayloadJson(
      JSON.stringify({
        ...payload(),
        eventName: "pull_request",
      }),
    );
    expect(parsed.ok).toBe(false);
    const asIssuePr = processGitHubIssuePayload(payload({ issue: { pullRequest: true } }));
    expect(asIssuePr.ignored).toBe(true);
    expect(asIssuePr.reason).toMatch(/pull request/i);
  });

  it("blocks a malformed payload", () => {
    const result = processGitHubIssuePayloadText("{not-json");
    expect(result.blocked).toBe(true);
    expect(result.ignored).toBe(false);
    expect(result.job).toBeNull();
    expect(processGitHubIssuePayload({ hello: "world" }).blocked).toBe(true);
  });
});

describe("GitHub Issue untrusted text", () => {
  it("keeps issue title shell injection as plain text", () => {
    const title = "git push --force yap";
    expect(() => commandFromUntrustedTaskText(title)).toThrow(/never become raw shell input/);
    const result = processGitHubIssuePayload(payload({ issue: { title } }));
    expect(result.blocked).toBe(true);
    expect(result.job?.rawInstruction).toBe(title);
    expect(result.job?.ownerResult).toBe("BLOCKED");
  });

  it("keeps issue body shell injection as plain text", () => {
    const body = "rm -rf data/multibrand && git reset --hard";
    expect(() => commandFromUntrustedTaskText(body)).toThrow();
    const result = processGitHubIssuePayload(
      payload({
        issue: { title: "Massimo Dutti'yi Markalar'a ekle", body },
      }),
    );
    expect(result.blocked).toBe(true);
    expect(result.job?.rawInstruction).toContain(body);
    expect(result.job?.githubIssue?.issueBody).toBe(body);
  });
});

describe("GitHub Issue domain routing", () => {
  it("routes Product Research Markalar tasks", () => {
    const result = processGitHubIssuePayload(payload());
    expect(result.job?.domain).toBe("PRODUCT_RESEARCH");
    expect(result.job?.destination).toBe("MARKALAR");
    expect(result.job?.template).toBe("PRODUCT_RESEARCH_BRAND_ONBOARDING");
    expect(result.job?.targetName).toBe("Massimo Dutti");
  });

  it("routes Romania Market Research separately", () => {
    const result = processGitHubIssuePayload(
      payload({
        issue: { title: "Romanya Pazar Araştırmasına Botta ekle" },
      }),
    );
    expect(result.job?.domain).toBe("MARKET_RESEARCH");
    expect(result.job?.destination).toBe("SALES_MARKET_BRANDS");
    expect(result.job?.salesMarket).toBe("RO");
    expect(result.job?.targetName).toBe("Botta");
    expect(result.job?.template).not.toMatch(/^PRODUCT_RESEARCH/);
  });

  it("routes Free People refresh to Pazaryerleri", () => {
    const result = processGitHubIssuePayload(
      payload({ issue: { title: "Free People ürünlerini güncelle" } }),
    );
    expect(result.job?.template).toBe("PRODUCT_RESEARCH_REFRESH");
    expect(result.job?.destination).toBe("PAZARYERLERI");
  });

  it("reviews an ambiguous task", () => {
    const result = processGitHubIssuePayload(payload({ issue: { title: "Massimo Dutti ekle" } }));
    expect(result.job?.ownerResult).toBe("REVIEW");
    expect(result.job?.parsedIntent.ambiguous).toBe(true);
    expect(result.job?.domain).toBeNull();
  });
});

describe("GitHub Issue report and metadata", () => {
  it("reuses the same report marker", () => {
    const first = processGitHubIssuePayload(payload());
    const second = processGitHubIssuePayload(payload());
    expect(first.comment).toContain(OPERATOR_REPORT_MARKER);
    expect(second.comment).toContain(OPERATOR_REPORT_MARKER);
    expect(commentUsesReportMarker(first.comment ?? "")).toBe(true);
    const existing = findExistingOperatorComment([
      { id: 1, body: "unrelated" },
      { id: 2, body: first.comment },
    ]);
    expect(existing?.id).toBe(2);
    expect(formatGitHubIssueComment(first.job!).startsWith(OPERATOR_REPORT_MARKER)).toBe(true);
  });

  it("does not mutate production paths", () => {
    const result = processGitHubIssuePayload(payload());
    expect(result.productionDataModified).toBe(false);
    expect(result.job?.productionDataModified).toBe(false);
    expect(pathIsProductionData("data/multibrand/products.json")).toBe(true);
  });

  it("retains GitHub issue source metadata and a stable task id", () => {
    const first = processGitHubIssuePayload(payload());
    const second = processGitHubIssuePayload(payload());
    expect(first.taskId).toBe(stableGitHubJobId("ersin/CAPONE_OPERATOR", 12));
    expect(first.taskId).toBe(second.taskId);
    expect(first.job?.githubIssue).toMatchObject({
      repository: "ersin/CAPONE_OPERATOR",
      issueNumber: 12,
      issueAuthor: "ersin",
      issueUrl: "https://github.com/ersin/CAPONE_OPERATOR/issues/12",
    });
    expect(first.job?.source).toBe("GITHUB_ISSUE");
    expect(first.job?.executionMode).toBe("BACKGROUND_SAFE");
  });
});
