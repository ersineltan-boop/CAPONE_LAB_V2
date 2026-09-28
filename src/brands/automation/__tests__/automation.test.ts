import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { ModelFamily, ModelFamilyVariant } from "../../../modelFamily/types";
import { createNotVerifiedNewness } from "../../../newArrivals/newness";
import type { BrandUniverseEntry, BrandUniverseFile } from "../../../registry/build/types";
import type { BrandOnboardingQueueFile, OnboardingAdapterFile } from "../../../onboarding/types";
import { applySourceAwareBrandReplacement } from "../delivery";
import { buildBrandAutomationPlan } from "../plan";

const NOW = "2026-09-26T12:00:00.000Z";

function universeBrand(overrides: Partial<BrandUniverseEntry> = {}): BrandUniverseEntry {
  return {
    id: "approved",
    brand: "APPROVED",
    officialUrl: "https://approved.test",
    country: "US",
    segment: "PREMIUM",
    influenceRole: "MARKET",
    trackingPriority: "P2",
    isActive: true,
    collectorType: "SHOPIFY_PUBLIC",
    collectionStatus: "READY_AUTOMATIC",
    footwearFocus: "WOMENS_FOOTWEAR",
    womenFootwearRelevant: true,
    sourceType: "BRAND",
    notes: "",
    footwearInfluence: 50,
    directionalInfluence: 50,
    commercialInfluence: 50,
    collectionPaths: ["/collections/shoes"],
    footwearCollectionUrls: ["https://approved.test/collections/shoes"],
    footwearCollectionHandles: ["shoes"],
    collectionDiscoveryStatus: "VERIFIED",
    productLimit: 100,
    backfillLimit: 100,
    supportsMultipleImages: true,
    discoverySources: [],
    classificationStatus: "REVIEWED",
    radarEligible: true,
    ...overrides,
  };
}

function queue(status: "READY" | "BLOCKED" = "READY"): BrandOnboardingQueueFile {
  return {
    version: 1,
    updatedAt: NOW,
    policy: { maxAttemptsPerRun: 5, maxActivationsPerRun: 3, retryDays: 7 },
    entries: [{
      brand: "QUEUED",
      slug: "queued",
      priority: 1,
      status,
      attempts: 1,
      lastAttemptAt: NOW,
      nextRetryAt: null,
      sourceUrl: "https://queued.test",
      detectedPlatform: "SHOPIFY",
      collectorStrategy: "shopify-public",
      blocker: null,
      productsFound: 12,
      activatedAt: null,
      notes: null,
    }],
  };
}

function adapters(): OnboardingAdapterFile {
  return {
    version: 1,
    updatedAt: NOW,
    adapters: {
      queued: {
        platform: "SHOPIFY",
        strategy: "shopify-public",
        sourceUrl: "https://queued.test",
        footwearPaths: ["/collections/shoes"],
      },
    },
  };
}

function variant(url: string, image: string): ModelFamilyVariant {
  return {
    productId: url,
    title: "Mystery Pump",
    url,
    color: null,
    material: null,
    images: [image],
  };
}

function family(input: {
  id?: string;
  brand?: string;
  variants: ModelFamilyVariant[];
  sourceId: string;
  sourceKind: "BRAND_OFFICIAL" | "LUXURY_MARKETPLACE";
}): ModelFamily {
  return {
    modelFamilyId: input.id ?? "approved--mystery",
    brand: input.brand ?? "APPROVED",
    canonicalName: "Mystery Pump",
    category: "PUMP",
    primaryCategory: "PUMP",
    representativeProductId: input.variants[0]?.productId ?? "missing",
    representativeImage: input.variants[0]?.images[0] ?? null,
    representativeImages: input.variants.flatMap((item) => item.images),
    variantCount: input.variants.length,
    variants: input.variants,
    allImages: input.variants.flatMap((item) => item.images),
    sourceProductIds: input.variants.map((item) => item.productId),
    groupingConfidence: "HIGH",
    groupingReason: "test",
    modelFamilyFirstSeenAt: NOW,
    sourceSightings: [{
      sourceId: input.sourceId,
      sourceLabel: input.sourceId,
      sourceKind: input.sourceKind,
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      newness: createNotVerifiedNewness(),
    }],
  };
}

describe("approved brand automation plan", () => {
  it("uses only last-good or explicitly adapter-approved Shopify sources", () => {
    const universe: BrandUniverseFile = {
      version: 1,
      brands: [
        universeBrand(),
        universeBrand({ id: "queued", brand: "QUEUED", officialUrl: "https://queued.test", isActive: false }),
        universeBrand({ id: "arbitrary", brand: "ARBITRARY", officialUrl: "https://arbitrary.test" }),
      ],
    };
    const plan = buildBrandAutomationPlan({
      universe,
      queue: queue(),
      adapters: adapters(),
      lastGoodSlugs: new Set(["approved"]),
    });
    expect(plan.candidates.map((item) => `${item.origin}:${item.slug}`)).toEqual([
      "APPROVED_QUEUE:queued",
      "LAST_GOOD:approved",
    ]);
    expect(plan.candidates.some((item) => item.slug === "arbitrary")).toBe(false);
  });

  it("is deterministic and treats an explicit zero limit as zero candidates", () => {
    const input = {
      universe: { version: 1 as const, brands: [universeBrand()] },
      queue: null,
      adapters: adapters(),
      lastGoodSlugs: new Set(["approved"]),
    };
    expect(buildBrandAutomationPlan(input).candidates.map((item) => item.slug)).toEqual(["approved"]);
    expect(buildBrandAutomationPlan({ ...input, limit: 0 }).candidates).toEqual([]);
  });
});

describe("source-aware official delivery replacement", () => {
  it("keeps one model card while refreshing official data and preserving marketplace evidence", () => {
    const oldOfficial = family({
      variants: [variant("https://approved.test/products/old", "https://img.test/old.jpg")],
      sourceId: "approved",
      sourceKind: "BRAND_OFFICIAL",
    });
    oldOfficial.sourceSightings?.push({
      sourceId: "market",
      sourceLabel: "MARKET",
      sourceKind: "LUXURY_MARKETPLACE",
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      newness: createNotVerifiedNewness(),
    });
    oldOfficial.variants.push(variant("https://market.test/item/1", "https://img.test/market.jpg"));
    oldOfficial.variantCount = oldOfficial.variants.length;
    const unrelatedFailedSource = family({
      id: "failed--stable",
      brand: "FAILED",
      variants: [variant("https://failed.test/products/stable", "https://img.test/stable.jpg")],
      sourceId: "failed",
      sourceKind: "BRAND_OFFICIAL",
    });
    const fresh = family({
      variants: [variant("https://approved.test/products/new", "https://img.test/new.jpg")],
      sourceId: "approved",
      sourceKind: "BRAND_OFFICIAL",
    });

    const result = applySourceAwareBrandReplacement([oldOfficial, unrelatedFailedSource], {
      slug: "approved",
      brand: "APPROVED",
      officialUrl: "https://approved.test",
      families: [fresh],
    });
    const combined = [...result.core, ...result.brandShard];
    expect(combined.filter((item) => item.modelFamilyId === "approved--mystery")).toHaveLength(1);
    expect(combined.some((item) => item.modelFamilyId.includes("brand-official"))).toBe(false);
    expect(result.brandShard[0]?.variants.map((item) => item.url)).toEqual([
      "https://approved.test/products/new",
      "https://market.test/item/1",
    ]);
    expect(result.brandShard[0]?.allImages).toEqual([
      "https://img.test/new.jpg",
      "https://img.test/market.jpg",
    ]);
    expect(result.brandShard[0]?.sourceSightings?.map((item) => item.sourceId).sort()).toEqual([
      "approved",
      "market",
    ]);
    expect(result.core).toContainEqual(unrelatedFailedSource);
  });
});

describe("twice-weekly workflow contract", () => {
  it("processes all approved brands and publishes only through the guarded Vercel gate", () => {
    const workflow = readFileSync(".github/workflows/capone-brand-onboarding.yml", "utf-8");
    const publisher = readFileSync("scripts/publish-validated-automation-pr.sh", "utf-8");
    expect(workflow).toContain('cron: "0 20 * * 0,3"');
    expect(workflow).toContain("npm run automate:brands");
    expect(workflow).toContain("group: capone-catalog-automation");
    expect(workflow).toContain("bash scripts/publish-validated-automation-pr.sh");
    expect(workflow).toContain("actions/upload-artifact@v4");
    expect(workflow).toContain("REQUESTED_LIMIT: ${{ inputs.limit || '' }}");
    expect(workflow).not.toContain("inputs.limit || '50'");
    expect(workflow).not.toContain("git push origin HEAD");
    expect(workflow).not.toContain("--draft");
    expect(publisher).toContain('wait_for_vercel "$head_sha" "preview"');
    expect(publisher).toContain("require_unchanged_main");
    expect(publisher).toContain('current_main" != "$base_sha');
    expect(publisher).toContain("gh pr merge");
    expect(publisher).toContain('wait_for_vercel "$merge_sha" "production"');
  });
});
