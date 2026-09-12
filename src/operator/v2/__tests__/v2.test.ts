import { describe, expect, it } from "vitest";

import { createMemoryStore } from "../../queue/store";
import { canReplaceExistingDataset } from "../../policies/collectSafety";
import { collectedAtDoesNotImplyNewArrival } from "../../policies/onboardingQuality";
import { visualMayDeduplicateAcrossSources } from "../../policies/domains";
import {
  commandFromUntrustedTaskText,
  evaluateAllowlistedCommand,
  isProductionCommandBlocked,
} from "../commands/policy";
import { executeJob } from "../executor/run";
import { createGitSnapshot, detectMutations } from "../guard/mutation";
import { parseOperatorIntake } from "../intake/parse";
import { createJobManifest } from "../job/create";
import { assertValidPlanSequence, buildExecutionPlan, isValidPlanTransition } from "../plan/builder";
import { formatOwnerSummary, ownerSummaryIsTurkish } from "../report/ownerSummary";
import { acceptTaskEnvelope, envelopeFromLocalCli, isTaskSource } from "../sources/intakeSource";
import type { GitSnapshot } from "../types";

describe("V2 task intake", () => {
  it("resolves a Markalar brand request to Product Research", () => {
    const parsed = parseOperatorIntake("Massimo Dutti'yi Markalar'a ekle");
    expect(parsed.template).toBe("PRODUCT_RESEARCH_BRAND_ONBOARDING");
    expect(parsed.domain).toBe("PRODUCT_RESEARCH");
    expect(parsed.targetType).toBe("BRAND");
    expect(parsed.targetName).toBe("Massimo Dutti");
    expect(parsed.destination).toBe("MARKALAR");
    expect(parsed.ownerApprovalRequired).toBe(true);
    expect(parsed.ambiguous).toBe(false);
  });

  it("does not turn a Markalar request into Market Research", () => {
    const parsed = parseOperatorIntake("Massimo Dutti'yi Markalar'a ekle");
    expect(parsed.domain).toBe("PRODUCT_RESEARCH");
    expect(parsed.destination).not.toBe("SALES_MARKET_BRANDS");
    expect(parsed.template).not.toMatch(/^MARKET_RESEARCH/);
  });

  it("resolves a Romania sales-market brand separately", () => {
    const parsed = parseOperatorIntake("Romanya Pazar Araştırmasına X markasını ekle");
    expect(parsed.template).toBe("MARKET_RESEARCH_BRAND_ONBOARDING");
    expect(parsed.domain).toBe("MARKET_RESEARCH");
    expect(parsed.targetName).toBe("X");
    expect(parsed.destination).toBe("SALES_MARKET_BRANDS");
    expect(parsed.salesMarket).toBe("RO");
    expect(parsed.destination).not.toBe("MARKALAR");
  });

  it("does not turn a Romania market request into Product Research", () => {
    const parsed = parseOperatorIntake("Romanya Pazar Araştırmasına X markasını ekle");
    expect(parsed.domain).toBe("MARKET_RESEARCH");
    expect(parsed.template).not.toMatch(/^PRODUCT_RESEARCH/);
  });

  it("resolves refresh, new arrivals and catalog QA without mixing domains", () => {
    expect(parseOperatorIntake("Free People ürünlerini güncelle")).toMatchObject({
      template: "PRODUCT_RESEARCH_REFRESH",
      domain: "PRODUCT_RESEARCH",
      targetName: "Free People",
      destination: "PAZARYERLERI",
    });
    expect(parseOperatorIntake("Pazaryerindeki yeni ürünleri kontrol et")).toMatchObject({
      template: "PRODUCT_RESEARCH_NEW_ARRIVALS_QA",
      domain: "PRODUCT_RESEARCH",
      destination: "NEW_ARRIVALS",
    });
    expect(parseOperatorIntake("Kategori ve görselleri QA et")).toMatchObject({
      template: "PRODUCT_RESEARCH_CATALOG_QA",
      domain: "PRODUCT_RESEARCH",
    });
  });

  it("sends an ambiguous task to REVIEW instead of guessing", () => {
    const parsed = parseOperatorIntake("Massimo Dutti ekle");
    expect(parsed.ambiguous).toBe(true);
    expect(parsed.template).toBe("AMBIGUOUS_REVIEW");
    expect(parsed.domain).toBeNull();
    const job = createJobManifest({ rawInstruction: "Massimo Dutti ekle" });
    expect(job.ownerResult).toBe("REVIEW");
  });

  it("reviews mixed-domain instructions", () => {
    const parsed = parseOperatorIntake("X'i hem Markalar'a hem Pazar Araştırmasına ekle");
    expect(parsed.ambiguous).toBe(true);
    expect(parsed.reason).toMatch(/mix/i);
  });
});

describe("V2 command allowlist", () => {
  it("allows known safe inspection and test commands", () => {
    expect(evaluateAllowlistedCommand(["git", "status"]).decision).toBe("ALLOW");
    expect(evaluateAllowlistedCommand(["git", "diff", "--check"]).decision).toBe("ALLOW");
    expect(evaluateAllowlistedCommand(["npm", "run", "operator:test"]).decision).toBe("ALLOW");
    expect(evaluateAllowlistedCommand(["npx", "tsc", "-b"]).decision).toBe("ALLOW");
  });

  it("blocks production push and requires approval for commit/push", () => {
    expect(isProductionCommandBlocked(["git", "push"])).toBe(true);
    expect(evaluateAllowlistedCommand(["git", "push"]).decision).toBe("REQUIRE_OWNER_APPROVAL");
    expect(evaluateAllowlistedCommand(["git", "commit", "-m", "x"]).decision).toBe(
      "REQUIRE_OWNER_APPROVAL",
    );
    expect(evaluateAllowlistedCommand(["vercel", "deploy"]).decision).toBe("REQUIRE_OWNER_APPROVAL");
  });

  it("denies force push and destructive commands", () => {
    expect(evaluateAllowlistedCommand(["git", "push", "--force"]).decision).toBe("DENY");
    expect(evaluateAllowlistedCommand(["git", "reset", "--hard"]).decision).toBe("DENY");
    expect(evaluateAllowlistedCommand(["rm", "-rf", "data/multibrand"]).decision).toBe("DENY");
  });

  it("never turns task text into a shell command", () => {
    expect(() => commandFromUntrustedTaskText("git push --force")).toThrow(
      /never become raw shell input/,
    );
    const parsed = parseOperatorIntake("Massimo Dutti'yi Markalar'a ekle && git push --force");
    expect(parsed.injectionAttempt).toBe(true);
    expect(parsed.ambiguous).toBe(true);
    const job = createJobManifest({
      rawInstruction: "Massimo Dutti'yi Markalar'a ekle && git push --force",
    });
    expect(job.ownerResult).toBe("BLOCKED");
    const ran: string[][] = [];
    executeJob(job, createMemoryStore(), {
      snapshotGit: () => createGitSnapshot(""),
      runCommand: (argv) => {
        ran.push([...argv]);
        return { exitCode: 0, stdout: "", stderr: "", notes: [], blockers: [] };
      },
    });
    expect(ran).toEqual([]);
  });
});

describe("V2 mutation guard and collect safety", () => {
  it("blocks unexpected and production file mutations", () => {
    const before = createGitSnapshot("");
    const production = detectMutations(
      before,
      createGitSnapshot(" M data/multibrand/products.json"),
    );
    expect(production.blocked).toBe(true);
    expect(production.production).toContain("data/multibrand/products.json");

    const unexpected = detectMutations(before, createGitSnapshot(" M src/App.tsx"));
    expect(unexpected.blocked).toBe(true);

    const allowed = detectMutations(before, createGitSnapshot("?? .operator/queue/job-1.json"));
    expect(allowed.blocked).toBe(false);
  });

  it("stops the executor when a step mutates production data", () => {
    const job = createJobManifest({
      rawInstruction: "Massimo Dutti'yi Markalar'a ekle",
      id: "job-mutation",
    });
    let calls = 0;
    const result = executeJob(job, createMemoryStore(), {
      snapshotGit: (): GitSnapshot => {
        calls += 1;
        return calls === 1
          ? createGitSnapshot("")
          : createGitSnapshot(" M data/multibrand/products.json");
      },
    });
    expect(result.job.ownerResult).toBe("BLOCKED");
    expect(result.job.blockers.some((item) => item.code === "UNEXPECTED_MUTATION")).toBe(true);
  });

  it("keeps failed/empty collect protection", () => {
    expect(
      canReplaceExistingDataset(
        { label: "valid", productCount: 20, valid: true },
        { label: "empty", productCount: 0, valid: false },
      ).allowed,
    ).toBe(false);
    const job = createJobManifest({ rawInstruction: "Kategori ve görselleri QA et" });
    expect(job.qa.emptyCollectProtected).toBe(true);
  });
});

describe("V2 plan, summary, sources and policies", () => {
  it("builds valid plan transitions for brand onboarding", () => {
    const parsed = parseOperatorIntake("Massimo Dutti'yi Markalar'a ekle");
    const steps = buildExecutionPlan(parsed);
    expect(isValidPlanTransition("QUEUED", "DISCOVERING")).toBe(true);
    expect(isValidPlanTransition("COLLECTING", "NORMALIZING")).toBe(true);
    expect(isValidPlanTransition("VALIDATING", "REVIEW")).toBe(true);
    expect(() => assertValidPlanSequence(steps)).not.toThrow();
    expect(steps.some((step) => step.state === "CLASSIFYING")).toBe(true);
    expect(steps.some((step) => step.state === "GROUPING")).toBe(true);
  });

  it("writes a Turkish owner summary", () => {
    const job = createJobManifest({ rawInstruction: "Massimo Dutti'yi Markalar'a ekle" });
    const text = formatOwnerSummary(job);
    expect(ownerSummaryIsTurkish(text)).toBe(true);
    expect(text).toContain("Massimo Dutti → Markalar");
    expect(text).toContain("Production değişikliği:");
    expect(text).toContain("YOK");
  });

  it("accepts future task sources without secrets", () => {
    expect(isTaskSource("GITHUB_ISSUE")).toBe(true);
    expect(isTaskSource("SCHEDULED_JOB")).toBe(true);
    expect(isTaskSource("CURSOR_CLOUD_AGENT")).toBe(true);
    const github = acceptTaskEnvelope({
      source: "GITHUB_ISSUE",
      requestedBy: "ersin",
      instruction: "Massimo Dutti'yi Markalar'a ekle",
      externalId: "issue-12",
    });
    expect(github.source).toBe("GITHUB_ISSUE");
    expect(JSON.stringify(github)).not.toMatch(/api[_-]?key|token|secret|password/i);
    expect(envelopeFromLocalCli("QA").source).toBe("LOCAL_CLI");
  });

  it("keeps marketplace provenance on a Visual dedupe job", () => {
    const parsed = parseOperatorIntake("Visual kanonik tekilleştir QA");
    expect(parsed.template).toBe("PRODUCT_RESEARCH_VISUAL_DEDUPE_QA");
    const visual = visualMayDeduplicateAcrossSources([
      {
        productKey: "luna",
        sourceKind: "BRAND",
        sourceId: "brand",
        sourceUrl: "https://brand.example/luna",
      },
      {
        productKey: "luna",
        sourceKind: "MARKETPLACE",
        sourceId: "farfetch",
        sourceUrl: "https://farfetch.example/luna",
      },
    ]);
    expect(visual.sourceCount).toBe(2);
    const job = createJobManifest({ rawInstruction: "Visual kanonik tekilleştir QA" });
    expect(job.qa.visualKeepsMarketplaceProvenance).toBe(true);
  });

  it("uses source evidence policy for New Arrival tasks", () => {
    const parsed = parseOperatorIntake("Pazaryerindeki yeni ürünleri kontrol et");
    expect(parsed.template).toBe("PRODUCT_RESEARCH_NEW_ARRIVALS_QA");
    expect(parsed.reason).toMatch(/source evidence|kaynak/i);
    expect(collectedAtDoesNotImplyNewArrival("2026-09-12T15:00:00.000Z")).toBe(true);
    const job = createJobManifest({
      rawInstruction: "Pazaryerindeki yeni ürünleri kontrol et",
    });
    expect(job.qa.newArrivalUsesSourceEvidence).toBe(true);
  });

  it("runs LOCAL_SAFE no-op execution without production writes", () => {
    const job = createJobManifest({
      rawInstruction: "Massimo Dutti'yi Markalar'a ekle",
      id: "job-local-safe",
    });
    const store = createMemoryStore();
    const result = executeJob(job, store, {
      snapshotGit: () => createGitSnapshot(""),
    });
    expect(result.job.executionMode).toBe("LOCAL_SAFE");
    expect(result.job.productionDataModified).toBe(false);
    expect(result.job.ownerResult).toBe("REVIEW");
    expect(store.read(".operator/reports/job-local-safe.md")).toContain("CAPONE OPERATOR");
  });
});
