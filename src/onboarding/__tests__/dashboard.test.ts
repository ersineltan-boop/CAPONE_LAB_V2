import { describe, expect, it } from "vitest";

import universe from "../../../data/registry/brand-universe.json";
import queue from "../../../data/registry/brand-onboarding-queue.json";
import report from "../../../data/registry/brand-onboarding-report.json";
import discovery from "../../../data/registry/brand-discovery-report.json";
import { buildBrandOnboardingDashboard } from "../../brandOnboarding/dashboard";
import { selectQueueCandidates } from "../queue";
import type { BrandUniverseFile } from "../../registry/build/types";
import type { BrandDiscoveryReport } from "../discovery";
import type { BrandOnboardingQueueFile, BrandOnboardingReportFile } from "../types";

describe("brand onboarding dashboard", () => {
  it("uses the published report and the queue's configured candidate limit", () => {
    const dashboard = buildBrandOnboardingDashboard(
      universe as BrandUniverseFile,
      queue as BrandOnboardingQueueFile,
      report as BrandOnboardingReportFile,
      discovery as BrandDiscoveryReport,
      new Date("2026-09-26T18:00:00.000Z"),
    );
    const activeCount = (universe as BrandUniverseFile).brands.filter((brand) => brand.isActive).length;
    expect(dashboard.summary.active).toBe(activeCount);
    expect(dashboard.summary.candidatePool).toBe((universe as BrandUniverseFile).brands.length - activeCount);
    expect(dashboard.summary.nextCandidates).toBeLessThanOrEqual(queue.policy.maxAttemptsPerRun);
    expect(dashboard.lastRunAt).toBe(report.generatedAt);
    expect(dashboard.lastRunAttempted).toBe(report.summary.attempted);
    expect(dashboard.lastRunActivated).toBe(report.summary.activated);
    expect(dashboard.summary.discovered).toBe(discovery.candidates.length);
    expect(dashboard.brands).toHaveLength(161);
    expect(dashboard.brands.find((entry) => entry.id === "bata")).toMatchObject({ isActive: true, status: "ACTIVE" });
    expect(dashboard.brands[0]?.id).toBe("massimo-dutti");
    expect(dashboard.brands.find((entry) => entry.id === "massimo-dutti")).toMatchObject({
      isPriority: true,
      status: "ACTIVE",
    });
    const selected = selectQueueCandidates(queue as BrandOnboardingQueueFile, {
      now: new Date("2026-09-26T18:00:00.000Z"),
      limit: queue.policy.maxAttemptsPerRun,
      skipSlugs: new Set((universe as BrandUniverseFile).brands.filter((entry) => entry.isActive).map((entry) => entry.id)),
    }).map((entry) => entry.slug);
    expect(dashboard.brands.filter((entry) => entry.isNextCandidate).map((entry) => entry.id)).toEqual(selected);
  });
});
