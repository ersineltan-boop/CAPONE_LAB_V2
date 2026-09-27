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
  it("uses repository data and caps the nightly queue", () => {
    const now = new Date("2026-09-26T21:30:00.000Z");
    const dashboard = buildBrandOnboardingDashboard(
      universe as BrandUniverseFile,
      queue as BrandOnboardingQueueFile,
      report as BrandOnboardingReportFile,
      discovery as BrandDiscoveryReport,
      now,
    );
    expect(dashboard.summary.active).toBe(universe.brands.filter((entry) => entry.isActive).length);
    expect(dashboard.summary.candidatePool).toBe(
      universe.brands.filter((entry) => !entry.isActive).length,
    );
    expect(dashboard.summary.tonight).toBeLessThanOrEqual(5);
    expect(dashboard.summary.discovered).toBe(discovery.candidates.length);
    expect(dashboard.brands).toHaveLength(universe.brands.length);
    expect(dashboard.brands[0]?.id).toBe("massimo-dutti");
    expect(dashboard.brands.find((entry) => entry.id === "massimo-dutti")).toMatchObject({
      isPriority: true,
    });
    const selected = selectQueueCandidates(queue as BrandOnboardingQueueFile, {
      now,
      limit: queue.policy.maxAttemptsPerRun,
    }).map((entry) => entry.slug);
    expect(dashboard.brands.filter((entry) => entry.isTonight).map((entry) => entry.id)).toEqual(
      selected,
    );
  });
});
