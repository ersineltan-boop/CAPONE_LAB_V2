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
    const dashboard = buildBrandOnboardingDashboard(
      universe as BrandUniverseFile,
      queue as BrandOnboardingQueueFile,
      report as BrandOnboardingReportFile,
      discovery as BrandDiscoveryReport,
      new Date("2026-09-26T18:00:00.000Z"),
    );
    expect(dashboard.summary.active).toBe(52);
    expect(dashboard.summary.candidatePool).toBe(108);
    expect(dashboard.summary.tonight).toBeLessThanOrEqual(5);
    expect(dashboard.summary.discovered).toBe(discovery.candidates.length);
    expect(dashboard.brands).toHaveLength(160);
    expect(dashboard.brands[0]?.id).toBe("massimo-dutti");
    expect(dashboard.brands.find((entry) => entry.id === "massimo-dutti")).toMatchObject({
      isPriority: true,
      status: "CUSTOM_ADAPTER_REQUIRED",
    });
    const selected = selectQueueCandidates(queue as BrandOnboardingQueueFile, {
      now: new Date("2026-09-26T18:00:00.000Z"),
      limit: 5,
      skipSlugs: new Set((universe as BrandUniverseFile).brands.filter((entry) => entry.isActive).map((entry) => entry.id)),
    }).map((entry) => entry.slug);
    expect(dashboard.brands.filter((entry) => entry.isTonight).map((entry) => entry.id)).toEqual(selected);
  });
});
