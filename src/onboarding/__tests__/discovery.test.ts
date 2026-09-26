import { describe, expect, it } from "vitest";

import type { BrandUniverseEntry } from "../../registry/build/types";
import { discoverMarketplaceBrandCandidates } from "../discovery";

const universeEntry = (id: string, brand: string): BrandUniverseEntry => ({
  id,
  brand,
  officialUrl: `https://${id}.example`,
  country: "Italy",
  segment: "UNCLASSIFIED",
  influenceRole: "UNCLASSIFIED",
  trackingPriority: "P2",
  isActive: false,
  collectorType: "UNKNOWN",
  collectionStatus: "NEEDS_PROBE",
  womenFootwearRelevant: true,
  sourceType: "BRAND",
  notes: "",
  footwearInfluence: 0,
  directionalInfluence: 0,
  commercialInfluence: 0,
  collectionPaths: [],
  productLimit: 20,
  supportsMultipleImages: false,
  discoverySources: [],
  classificationStatus: "UNREVIEWED",
  radarEligible: false,
});

describe("marketplace brand discovery", () => {
  it("uses approved marketplaces and excludes existing and sports brands", () => {
    const report = discoverMarketplaceBrandCandidates(
      [
        { source: "farfetch", brand: "New Label", productUrl: "https://farfetch.test/1" },
        { source: "level-shoes", brand: "NEW LABEL", productUrl: "https://level.test/2" },
        { source: "amazon", brand: "Unsafe Label", productUrl: "https://amazon.test/1" },
        { source: "farfetch", brand: "Nike", productUrl: "https://farfetch.test/nike-1" },
        { source: "level-shoes", brand: "Nike", productUrl: "https://level.test/nike-2" },
        { source: "farfetch", brand: "Adidas by Stella McCartney", productUrl: "https://farfetch.test/adidas-1" },
        { source: "level-shoes", brand: "Adidas by Stella McCartney", productUrl: "https://level.test/adidas-2" },
        { source: "farfetch", brand: "New Balance", productUrl: "https://farfetch.test/nb-1" },
        { source: "level-shoes", brand: "New Balance", productUrl: "https://level.test/nb-2" },
        { source: "farfetch", brand: "Known Label", productUrl: "https://farfetch.test/known-1" },
        { source: "level-shoes", brand: "Known Label", productUrl: "https://level.test/known-2" },
      ],
      [universeEntry("known-label", "KNOWN LABEL")],
      "2026-09-26T00:00:00.000Z",
    );

    expect(report.candidates).toEqual([
      {
        id: "new-label",
        brand: "NEW LABEL",
        status: "DISCOVERED_NEEDS_OFFICIAL_SOURCE",
        marketplaceSources: ["farfetch", "level-shoes"],
        productCount: 2,
        sampleProductUrl: "https://farfetch.test/1",
      },
    ]);
  });

  it("requires at least two distinct product URLs", () => {
    const report = discoverMarketplaceBrandCandidates(
      [
        { source: "the-webster", brand: "One Hit", productUrl: "https://webster.test/1" },
        { source: "the-webster", brand: "One Hit", productUrl: "https://webster.test/1" },
      ],
      [],
    );
    expect(report.candidates).toEqual([]);
  });
});
