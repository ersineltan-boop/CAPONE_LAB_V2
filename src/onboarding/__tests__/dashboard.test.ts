import { describe, expect, it } from "vitest";

import universe from "../../../data/registry/brand-universe.json";
import queue from "../../../data/registry/brand-onboarding-queue.json";
import report from "../../../data/registry/brand-onboarding-report.json";
import discovery from "../../../data/registry/brand-discovery-report.json";
import { buildBrandOnboardingDashboard } from "../../brandOnboarding/dashboard";
import { selectQueueCandidates } from "../queue";
import { SCHEDULED_ONBOARDING_MAX_ATTEMPTS } from "../selection";
import type { BrandUniverseFile } from "../../registry/build/types";
import type { BrandDiscoveryReport } from "../discovery";
import type { BrandOnboardingQueueFile, BrandOnboardingReportFile } from "../types";

describe("brand onboarding dashboard", () => {
  it("uses the published report and the scheduled candidate limit", () => {
    const now = new Date("2099-01-01T00:00:00.000Z");
    const registry = universe as BrandUniverseFile;
    const dashboard = buildBrandOnboardingDashboard(
      registry,
      queue as BrandOnboardingQueueFile,
      report as BrandOnboardingReportFile,
      discovery as BrandDiscoveryReport,
      now,
    );
    const activeBrands = registry.brands.filter((brand) => brand.isActive);
    const activeCount = activeBrands.length;
    expect(dashboard.summary.active).toBe(activeCount);
    expect(dashboard.summary.candidatePool).toBe(registry.brands.length - activeCount);
    expect(dashboard.summary.nextCandidates).toBe(SCHEDULED_ONBOARDING_MAX_ATTEMPTS);
    expect(dashboard.lastRun).toEqual({
      at: report.generatedAt,
      attempted: report.summary.attempted,
      activated: report.summary.activated,
    });
    expect(dashboard.summary.discovered).toBe(discovery.candidates.length);
    expect(dashboard.brands).toHaveLength(registry.brands.length);
    expect(dashboard.brands.find((entry) => entry.id === "bata")).toMatchObject({ isActive: true, status: "ACTIVE" });
    expect(dashboard.brands[0]?.id).toBe("massimo-dutti");
    expect(dashboard.brands.find((entry) => entry.id === "massimo-dutti")).toMatchObject({
      isPriority: true,
      status: "ACTIVE",
    });
    const selected = selectQueueCandidates(queue as BrandOnboardingQueueFile, {
      now,
      limit: SCHEDULED_ONBOARDING_MAX_ATTEMPTS,
      scheduled: true,
      skipSlugs: new Set(activeBrands.map((entry) => entry.id)),
    }).map((entry) => entry.slug);
    expect(dashboard.brands.filter((entry) => entry.isNextCandidate).map((entry) => entry.id).sort()).toEqual(selected.sort());
  });

  it("distinguishes a recorded zero-candidate run from a missing report or rehearsal", () => {
    const emptyScan = {
      ...report as BrandOnboardingReportFile,
      summary: { ...report.summary, attempted: 0, activated: 0 },
      attempts: [],
    };
    const build = (run: BrandOnboardingReportFile) => buildBrandOnboardingDashboard(
      universe as BrandUniverseFile,
      queue as BrandOnboardingQueueFile,
      run,
      discovery as BrandDiscoveryReport,
    ).lastRun;

    expect(build(emptyScan)).toEqual({ at: report.generatedAt, attempted: 0, activated: 0 });
    expect(build({ ...emptyScan, generatedAt: "" })).toBeNull();
    expect(build({ ...emptyScan, generatedAt: "invalid-date" })).toBeNull();
    expect(build({ ...emptyScan, dryRun: true })).toBeNull();
  });
});
