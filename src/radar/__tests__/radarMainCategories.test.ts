import { describe, expect, it } from "vitest";

import {
  buildRadarNavCategories,
  RADAR_ATTRIBUTE_CATEGORIES,
  RADAR_MAIN_CATEGORIES,
  sourceCategoriesForNav,
} from "../radarMainCategories";
import type { MasterRadarBuildResult } from "../master/types";

function radarResult(
  categories: MasterRadarBuildResult["categories"],
): MasterRadarBuildResult {
  return {
    categories,
    allSignals: [],
    comparisonAvailable: false,
    collectedAt: "2026-08-18T10:00:00.000Z",
  };
}

describe("radarMainCategories", () => {
  it("shows only main categories in navigation", () => {
    const nav = buildRadarNavCategories(
      radarResult([
        {
          category: "PUMP",
          earlySignals: [],
          commercialSignals: [],
          familyCount: 10,
        },
        {
          category: "SLINGBACK",
          earlySignals: [],
          commercialSignals: [],
          familyCount: 5,
        },
        {
          category: "BOOT",
          earlySignals: [],
          commercialSignals: [],
          familyCount: 8,
        },
        {
          category: "ANKLE_BOOT",
          earlySignals: [],
          commercialSignals: [],
          familyCount: 4,
        },
      ]),
    );

    expect(nav.map((slice) => slice.category)).toEqual(["PUMP", "BOOT"]);
    expect(nav.find((slice) => slice.category === "BOOT")?.familyCount).toBe(12);
  });

  it("keeps attribute categories out of main navigation list", () => {
    expect(RADAR_MAIN_CATEGORIES).not.toContain("SLINGBACK");
    expect(RADAR_ATTRIBUTE_CATEGORIES).toEqual([
      "SLINGBACK",
      "MARY_JANE",
      "THONG",
      "WEDGE",
    ]);
  });

  it("rolls ankle boots under boot tab", () => {
    expect(sourceCategoriesForNav("BOOT")).toEqual(["BOOT", "ANKLE_BOOT"]);
  });
});
