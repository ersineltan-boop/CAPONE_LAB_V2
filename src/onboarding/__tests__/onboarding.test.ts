import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { getCollectableBrands } from "../../registry/collection/brandToCollector";
import { loadBrandRegistry } from "../../registry/data";
import type { PilotProduct } from "../../collector/types";
import { isGenericModelTitle } from "../../modelFamily/genericModelTitle";
import {
  createInitialQueue,
  mergeQueueWithDefaults,
  mergeQueueWithUniverseCandidates,
  remainingActivationSlots,
  selectQueueCandidates,
  blockedDoesNotConsumeActivationQuota,
  updateQueueEntry,
} from "../queue";
import { retryAt, INITIAL_ONBOARDING_BRANDS } from "../policy";
import { fingerprintStorefront } from "../platforms";
import { probeBrandSource } from "../probe";
import { createBudgetedProbeHttp } from "../http";
import {
  auditFootwearLeakage,
  evaluateOfficialSourceCoverage,
  evaluateQualityGate,
} from "../validate";
import { marketplaceCoverageForBrand } from "../marketplaceCoverage";
import { canPublishOnboardingCommit, decidePublish, shouldStageOnboardingPath } from "../publish";
import { cleanupStaging, writeStaging } from "../staging";
import { mergeValidatedBrandIntoCatalog, prepareFirstBrandBaseline } from "../activate";
import { runBrandOnboarding } from "../runOnboarding";
import type { OnboardingHttp } from "../http";
import type { BrandOnboardingQueueFile } from "../types";

function shoe(overrides: Partial<PilotProduct> = {}): PilotProduct {
  return {
    source: "test-brand",
    brand: "TEST BRAND",
    productName: "Lana Pump",
    productUrl: "https://example.com/products/lana-pump",
    imageUrl: "https://cdn.example.com/1.jpg",
    images: ["https://cdn.example.com/1.jpg", "https://cdn.example.com/2.jpg"],
    category: "PUMP",
    color: "Black",
    material: "Leather",
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: null,
    discoveredAt: "2026-08-22T00:00:00.000Z",
    variants: [{ title: "Lana Pump Black", color: "Black", sku: "LANA-BLK", imageUrl: "https://cdn.example.com/1.jpg" }],
    ...overrides,
  };
}

describe("onboarding queue policy", () => {
  it("retains official product evidence for opaque model names without accepting bags", () => {
    expect(auditFootwearLeakage([shoe({productName: "TURA OYA BLACK", productUrl: "https://example.com/products/tura-oya-black", category: "BALLERINA", sourceProductType: "Mary-Jane", sourceProductTags: ["ballerina shoes"]})])).toEqual([]);
    expect(auditFootwearLeakage([shoe({productName: "Leather handbag", sourceProductType: "Bags", sourceProductTags: ["shoes"]})])).toHaveLength(1);
  });
  it("includes the catalog shard directory in the publication allowlist", () => {
    expect(shouldStageOnboardingPath("data/multibrand/model-families")).toBe(true);
    expect(shouldStageOnboardingPath("data/multibrand/model-families/manifest.json")).toBe(true);
    expect(shouldStageOnboardingPath("data/multibrand/model-families/part-000.json")).toBe(true);
    expect(shouldStageOnboardingPath("public/data/catalog/")).toBe(false);
  });
  it("orders the priority brands and does not drop current collectable brands", () => {
    const queue = createInitialQueue();
    expect(queue.policy.maxAttemptsPerRun).toBe(25);
    expect(queue.policy.maxActivationsPerRun).toBe(3);
    expect(queue.entries.map((entry) => entry.slug)).toEqual(
      INITIAL_ONBOARDING_BRANDS.map((item) => item.slug),
    );
    expect(getCollectableBrands(loadBrandRegistry().all()).length).toBeGreaterThanOrEqual(52);
  });

  it("skips future retry dates and continues after a blocked candidate", () => {
    const now = new Date("2026-08-22T20:00:00.000Z");
    const queue = createInitialQueue();
    const maison = queue.entries.find((entry) => entry.slug === "maison-margiela");
    const isabel = queue.entries.find((entry) => entry.slug === "isabel-marant");
    expect(maison).toBeDefined();
    expect(isabel).toBeDefined();
    maison!.status = "PRIORITY_BLOCKED";
    maison!.nextRetryAt = retryAt(now, 7);
    isabel!.status = "PENDING";
    const selected = selectQueueCandidates(queue, { now, limit: 5 });
    expect(selected.some((entry) => entry.slug === "isabel-marant")).toBe(true);
    expect(selected.some((entry) => entry.slug === "maison-margiela")).toBe(false);
  });

  it("does not let a PARTIAL candidate occupy the same slot every night", () => {
    const now = new Date("2026-09-26T21:30:00.000Z");
    const queue = createInitialQueue();
    const partial = queue.entries.find((entry) => entry.slug === "maison-margiela")!;
    partial.status = "PARTIAL";
    partial.nextRetryAt = retryAt(now);
    const selected = selectQueueCandidates(queue, { now: new Date("2026-09-27T21:30:00.000Z"), limit: 1 });
    expect(selected[0]?.slug).not.toBe("maison-margiela");
  });

  it("does not spend a nightly slot on a known invalid official URL", () => {
    const queue = createInitialQueue();
    const invalid = queue.entries.find((entry) => entry.slug === "maison-margiela")!;
    invalid.status = "BLOCKED";
    invalid.sourceUrl = "invalid";
    expect(selectQueueCandidates(queue, { limit: 2 }).map((entry) => entry.slug)).not.toContain("maison-margiela");
  });

  it("reserves one nightly discovery slot when luxury priority would fill all attempts", () => {
    const queue = createInitialQueue();
    const now = new Date("2026-09-27T18:00:00.000Z");
    for (const entry of queue.entries) {
      if (["naked-wolfe", "cos", "stuart-weitzman", "sam-edelman", "vagabond-shoemakers"].includes(entry.slug)) {
        entry.status = "PRIORITY_BLOCKED";
        entry.nextRetryAt = retryAt(now);
      }
    }
    queue.entries.push({
      ...queue.entries[0],
      brand: "BOBBIES",
      slug: "bobbies",
      priority: 100,
      sourceUrl: "https://www.bobbies.com",
      status: "PENDING",
      nextRetryAt: null,
    });
    const selected = selectQueueCandidates(queue, { now, limit: 5 });
    expect(selected).toHaveLength(5);
    expect(selected.slice(0, 4).map((entry) => entry.slug)).toEqual([
      "massimo-dutti", "mango", "maison-margiela", "isabel-marant",
    ]);
    expect(selected[4].slug).toBe("bobbies");
    expect(selectQueueCandidates(queue, { now, limit: 5, only: ["ganni"] }).map((entry) => entry.slug)).toEqual(["ganni"]);
  });

  it("caps successful activations independently of blocked attempts", () => {
    expect(remainingActivationSlots(3, 0)).toBe(3);
    expect(remainingActivationSlots(3, 3)).toBe(0);
    expect(blockedDoesNotConsumeActivationQuota("PRIORITY_BLOCKED")).toBe(true);
    expect(blockedDoesNotConsumeActivationQuota("ACTIVE")).toBe(false);
  });

  it("preserves queue state across reruns", () => {
    const first = createInitialQueue({ "maison-margiela": "https://www.maisonmargiela.com" });
    const updated = updateQueueEntry(first, "maison-margiela", {
      status: "PRIORITY_BLOCKED",
      attempts: 1,
      blocker: "HTTP 403",
    });
    const merged = mergeQueueWithDefaults(updated);
    expect(merged.entries.find((entry) => entry.slug === "maison-margiela")?.status).toBe(
      "PRIORITY_BLOCKED",
    );
    expect(merged.entries).toHaveLength(INITIAL_ONBOARDING_BRANDS.length);
  });

  it("adds every eligible inactive universe brand while preserving history", () => {
    const current = updateQueueEntry(createInitialQueue(), "maison-margiela", {
      status: "PRIORITY_BLOCKED",
      attempts: 2,
      blocker: "HTTP 403",
    });
    const merged = mergeQueueWithUniverseCandidates(current, [
      {
        id: "active-brand",
        brand: "ACTIVE BRAND",
        officialUrl: "https://active.example",
        country: "Italy",
        segment: "PREMIUM",
        influenceRole: "MARKET",
        trackingPriority: "P1",
        isActive: true,
        collectorType: "SHOPIFY_PUBLIC",
        collectionStatus: "READY_AUTOMATIC",
        womenFootwearRelevant: true,
        sourceType: "BRAND",
        notes: "",
        footwearInfluence: 0,
        directionalInfluence: 0,
        commercialInfluence: 0,
        collectionPaths: [],
        productLimit: 20,
        supportsMultipleImages: true,
        discoverySources: [],
        classificationStatus: "REVIEWED",
        radarEligible: false,
      },
      {
        id: "fresh-brand",
        brand: "FRESH BRAND",
        officialUrl: "https://fresh.example",
        country: "Spain",
        segment: "CONTEMPORARY",
        influenceRole: "EARLY_ADOPTER",
        trackingPriority: "P1",
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
      },
      {
        id: "adapter-brand",
        brand: "ADAPTER BRAND",
        officialUrl: "https://adapter.example",
        country: "France",
        segment: "LUXURY",
        influenceRole: "LEADER",
        trackingPriority: "P2",
        isActive: false,
        collectorType: "CUSTOM_ADAPTER",
        collectionStatus: "NEEDS_CUSTOM_ADAPTER",
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
      },
    ]);

    expect(merged.entries.find((entry) => entry.slug === "active-brand")).toBeUndefined();
    expect(merged.entries.find((entry) => entry.slug === "fresh-brand")?.status).toBe("PENDING");
    expect(merged.entries.find((entry) => entry.slug === "adapter-brand")?.status).toBe(
      "CUSTOM_ADAPTER_REQUIRED",
    );
    expect(merged.entries.find((entry) => entry.slug === "maison-margiela")?.attempts).toBe(2);
  });
});

describe("onboarding safety gates", () => {
  it("requires exhausted pagination and source-total coverage before auto activation", () => {
    expect(
      evaluateOfficialSourceCoverage({
        errors: [],
        paginationExhausted: true,
        rawProductUrlsDiscovered: 80,
        sourceReportedProductCount: 80,
        acceptedProductCount: 80,
        hitCollectionCrawlCap: false,
      }).full,
    ).toBe(true);
    expect(
      evaluateOfficialSourceCoverage({
        errors: [],
        paginationExhausted: true,
        rawProductUrlsDiscovered: 79,
        sourceReportedProductCount: 80,
        acceptedProductCount: 79,
        hitCollectionCrawlCap: false,
      }),
    ).toMatchObject({ full: false, reasons: ["Kaynak URL kapsamı eksik: 79/80", "Kabul edilen ayakkabı kapsamı eksik: 79/80"] });
    expect(
      evaluateOfficialSourceCoverage({
        errors: [],
        paginationExhausted: false,
        rawProductUrlsDiscovered: 80,
        sourceReportedProductCount: 80,
        acceptedProductCount: 80,
        hitCollectionCrawlCap: false,
      }).full,
    ).toBe(false);
  });

  it("fails closed when the official footwear total, accepted count, or crawl-cap evidence is missing", () => {
    const complete = {
      errors: [],
      paginationExhausted: true,
      rawProductUrlsDiscovered: 80,
      sourceReportedProductCount: 80,
      acceptedProductCount: 80,
      hitCollectionCrawlCap: false,
    };
    expect(evaluateOfficialSourceCoverage({ ...complete, sourceReportedProductCount: null }).full).toBe(false);
    expect(evaluateOfficialSourceCoverage({ ...complete, acceptedProductCount: 20 }).full).toBe(false);
    expect(evaluateOfficialSourceCoverage({ ...complete, hitCollectionCrawlCap: undefined }).full).toBe(false);
  });

  it("starts the first official brand catalog without false NEW badges", () => {
    const incoming = shoe({ isNewArrivalsCollection: true, hasNewBadge: true });
    expect(prepareFirstBrandBaseline([incoming])[0]).toMatchObject({
      isNewArrivalsCollection: false,
      hasNewBadge: false,
    });
    expect(incoming.isNewArrivalsCollection).toBe(true);
  });

  it("rejects apparel/bag leakage", () => {
    const leaks = auditFootwearLeakage([
      shoe({
        productName: "City Tote",
        productUrl: "https://example.com/products/city-tote",
        category: null,
        sourceCategoryName: "Handbags",
      }),
    ]);
    expect(leaks.length).toBeGreaterThan(0);
  });

  it("failed quality gate cannot activate", () => {
    const gate = evaluateQualityGate([
      shoe({
        productName: "Wool Coat",
        category: null,
        sourceCategoryName: "Ready to wear",
        productUrl: "https://example.com/products/coat",
      }),
    ]);
    expect(gate.ok).toBe(false);
    expect(gate.completeness).toBe("FAILED");
    expect(gate.decisionLog.startsWith("REJECTED:")).toBe(true);
  });

  it("marks thin catalogs as PARTIAL and logs manual-review decision", () => {
    const gate = evaluateQualityGate([
      shoe({ productUrl: "https://example.com/products/a" }),
      shoe({
        productName: "Lana Pump Nude",
        productUrl: "https://example.com/products/b",
        color: "Nude",
        variants: [{ title: "Lana Pump Nude", color: "Nude", sku: "LANA-NUD" }],
      }),
    ]);
    expect(gate.ok).toBe(true);
    expect(gate.completeness).toBe("PARTIAL");
    expect(gate.decisionLog).toContain("PARTIAL / MANUAL REVIEW");
  });

  it("model family gate keeps generic titles from collapsing into one color family", () => {
    const blob = Array.from({ length: 8 }, (_, index) =>
      shoe({
        productName: "Boot",
        productUrl: `https://example.com/products/boot-${index}`,
        color: `Color ${index}`,
        variants: [{ title: `Boot ${index}`, color: `Color ${index}`, sku: `BOOT-${index}` }],
      }),
    );
    const gate = evaluateQualityGate(blob);
    expect(isGenericModelTitle("boot")).toBe(true);
    expect(gate.families).toBe(8);
    expect(gate.reasons.some((reason) => reason.includes("generic-title"))).toBe(false);
  });

  it("marketplace coverage is recorded without becoming the official source", () => {
    const coverage = marketplaceCoverageForBrand(
      [
        { source: "farfetch", brand: "Maison Margiela" },
        { source: "level-shoes", brand: "MAISON MARGIELA" },
        { source: "maison-margiela", brand: "MAISON MARGIELA" },
      ],
      "MAISON MARGIELA",
    );
    expect(coverage).toEqual({ farfetch: 1, levelShoes: 1 });
  });

  it("storage threshold and failed tests/build block publish", () => {
    expect(
      canPublishOnboardingCommit({
        testsPassed: true,
        buildPassed: true,
        storageStatus: "ok",
        trackedFileTooLarge: false,
      }),
    ).toBe(true);
    expect(
      decidePublish({
        testsPassed: false,
        buildPassed: true,
        storageStatus: "ok",
        trackedFileTooLarge: false,
      }).reason,
    ).toBe("tests failed");
    expect(
      decidePublish({
        testsPassed: true,
        buildPassed: false,
        storageStatus: "ok",
        trackedFileTooLarge: false,
      }).reason,
    ).toBe("production build failed");
    expect(
      decidePublish({
        testsPassed: true,
        buildPassed: true,
        storageStatus: "STORAGE_LIMIT",
        trackedFileTooLarge: false,
      }).reason,
    ).toBe("STORAGE_LIMIT");
  });

  it("does not stage catalog frontend, staging dumps, or env files", () => {
    expect(shouldStageOnboardingPath("public/data/catalog/brands/schutz.json")).toBe(false);
    expect(shouldStageOnboardingPath("data/onboarding/staging/mango/products.json")).toBe(false);
    expect(shouldStageOnboardingPath(".env")).toBe(false);
    expect(shouldStageOnboardingPath("dist/index.html")).toBe(false);
    expect(shouldStageOnboardingPath("data/registry/brand-onboarding-queue.json")).toBe(true);
    expect(shouldStageOnboardingPath("data/multibrand/products.json")).toBe(true);
  });
});

describe("onboarding fingerprints", () => {
  it("bounds slow probes without affecting the full collector", async () => {
    let clock = 0;
    const seenTimeouts: number[] = [];
    const underlying: OnboardingHttp = {
      async fetchText(url, options) {
        seenTimeouts.push(options?.timeoutMs ?? 0);
        clock += 4_000;
        return { ok: false, status: 403, text: "", url };
      },
    };
    const probeHttp = createBudgetedProbeHttp(underlying, {
      now: () => clock,
      budgetMs: 10_000,
      requestTimeoutMs: 5_000,
    });
    await probeHttp.fetchText("https://example.com/one");
    await probeHttp.fetchText("https://example.com/two");
    expect(seenTimeouts).toEqual([5_000, 5_000]);
    await probeHttp.fetchText("https://example.com/three");
    expect(seenTimeouts[2]).toBe(2_000);
    await expect(probeHttp.fetchText("https://example.com/four")).rejects.toThrow("time budget");
    await underlying.fetchText("https://example.com/full");
    expect(seenTimeouts[3]).toBe(0);
  });

  it("recognizes Shopify, Inditex-like, Salesforce and Next.js public markers", () => {
    expect(fingerprintStorefront({ html: "cdn.shopify.com Shopify.theme" }).platform).toBe("SHOPIFY");
    expect(fingerprintStorefront({ html: "itxrest categories?ajax=true" }).platform).toBe(
      "INDITEX-LIKE PUBLIC CATALOG",
    );
    expect(fingerprintStorefront({ html: "demandware /on/demandware/store" }).platform).toBe(
      "SALESFORCE COMMERCE",
    );
    expect(fingerprintStorefront({ html: "__NEXT_DATA__ /_next/static" }).platform).toBe(
      "NEXT.JS PUBLIC DATA",
    );
  });

  it("avoids irrelevant Inditex endpoints for luxury brands but retains known Inditex probes", async () => {
    const requested: string[] = [];
    const http: OnboardingHttp = {
      async fetchText(url) {
        requested.push(url);
        return { ok: false, status: 404, text: "", url };
      },
    };
    await probeBrandSource({ slug: "gucci", brand: "GUCCI", sourceUrl: "https://www.gucci.com", http });
    expect(requested.some((url) => url.includes("categories?ajax=true"))).toBe(false);
    requested.length = 0;
    await probeBrandSource({ slug: "massimo-dutti", brand: "MASSIMO DUTTI", sourceUrl: "https://www.massimodutti.com", http });
    expect(requested.some((url) => url.includes("categories?ajax=true"))).toBe(true);
  });
});

describe("onboarding run", () => {
  async function tempRoot(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "capone-onboard-"));
    await mkdir(join(root, "data/registry"), { recursive: true });
    await mkdir(join(root, "data/multibrand"), { recursive: true });
    await mkdir(join(root, "data/onboarding"), { recursive: true });
    await writeFile(
      join(root, "data/registry/brand-universe.json"),
      JSON.stringify({
        version: 1,
        brands: [
          {
            id: "maison-margiela",
            brand: "MAISON MARGIELA",
            officialUrl: "https://www.maisonmargiela.com",
            country: "France",
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
          },
          {
            id: "isabel-marant",
            brand: "ISABEL MARANT",
            officialUrl: "https://www.isabelmarant.com",
            country: "France",
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
          },
          {
            id: "massimo-dutti",
            brand: "MASSIMO DUTTI",
            officialUrl: "https://www.massimodutti.com",
            country: "Spain",
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
          },
        ],
      }),
      "utf-8",
    );
    await writeFile(
      join(root, "data/multibrand/products.json"),
      JSON.stringify([
        shoe({
          source: "schutz",
          brand: "SCHUTZ",
          productUrl: "https://schutz-shoes.com/products/lexi",
        }),
        shoe({
          source: "farfetch",
          brand: "MAISON MARGIELA",
          productUrl: "https://www.farfetch.com/item/margiela",
        }),
      ]),
      "utf-8",
    );
    return root;
  }

  it("dry-run staging does not mutate production catalog and blocked brands continue the queue", async () => {
    const root = await tempRoot();
    const http: OnboardingHttp = {
      async fetchText(url) {
        if (url.includes("maisonmargiela.com") && !url.includes("sitemap") && !url.includes("products.json")) {
          return { ok: false, status: 403, text: "Akamai", url, error: "HTTP 403" };
        }
        if (url.includes("isabelmarant.com") && url.includes("products.json")) {
          return {
            ok: true,
            status: 200,
            url,
            text: JSON.stringify({
              products: [
                {
                  handle: "lili-boot",
                  title: "Lili Boot",
                  product_type: "Boots",
                  tags: ["shoes"],
                  images: [{ src: "https://cdn.example.com/boot.jpg" }, { src: "https://cdn.example.com/boot2.jpg" }],
                  variants: [{ sku: "LILI-BLK" }],
                },
              ],
            }),
          };
        }
        if (url.includes("isabelmarant.com")) {
          return { ok: true, status: 200, text: "cdn.shopify.com Shopify.theme", url };
        }
        return { ok: false, status: 404, text: "", url };
      },
    };

    const before = await readFile(join(root, "data/multibrand/products.json"), "utf-8");
    const result = await runBrandOnboarding(
      root,
      {
        dryRun: true,
        limit: 3,
        only: ["maison-margiela", "isabel-marant", "massimo-dutti"],
        now: new Date("2026-08-22T20:00:00.000Z"),
      },
      http,
    );
    const after = await readFile(join(root, "data/multibrand/products.json"), "utf-8");
    expect(after).toBe(before);
    expect(result.activated).toEqual([]);
    expect(result.report.summary.activeBrandsBefore).toBe(getCollectableBrands(loadBrandRegistry().all()).length);
    expect(result.report.summary.activeBrandsAfter).toBe(result.report.summary.activeBrandsBefore);
    expect(result.attempted).toContain("maison-margiela");
    expect(result.attempted).toContain("isabel-marant");
    const queue = JSON.parse(
      await readFile(join(root, "data/registry/brand-onboarding-queue.json"), "utf-8"),
    ) as BrandOnboardingQueueFile;
    expect(queue.entries.find((entry) => entry.slug === "maison-margiela")?.status).not.toBe("ACTIVE");
    const adapterWork = JSON.parse(
      await readFile(join(root, "data/registry/brand-adapter-work-queue.json"), "utf-8"),
    ) as Array<{ slug: string }>;
    expect(adapterWork.every((entry) => queue.entries.find((candidate) => candidate.slug === entry.slug)?.status === "CUSTOM_ADAPTER_REQUIRED")).toBe(true);
    await rm(root, { recursive: true, force: true });
  });

  it("cleans stale staging directories", async () => {
    const root = await tempRoot();
    await writeStaging(root, {
      slug: "mango",
      brand: "MANGO",
      probedAt: new Date().toISOString(),
      probe: {
        platform: "UNKNOWN",
        strategy: "none",
        status: "FAILED",
        sourceUrl: "https://shop.mango.com",
        collectionPaths: [],
        footwearPaths: [],
        products: [],
        blocker: "test",
        notes: null,
      },
      products: [],
    });
    await cleanupStaging(root);
    await expect(readFile(join(root, "data/onboarding/staging/mango/products.json"), "utf-8")).rejects.toThrow();
    await rm(root, { recursive: true, force: true });
  });

  it("activation merge cannot rewrite another official source", async () => {
    const root = await tempRoot();
    await mergeValidatedBrandIntoCatalog({
      root,
      slug: "maison-margiela",
      products: [
        shoe({
          source: "maison-margiela",
          brand: "MAISON MARGIELA",
          productUrl: "https://www.maisonmargiela.com/products/tabi-boot",
        }),
      ],
      status: "success",
    });
    const merged = JSON.parse(await readFile(join(root, "data/multibrand/products.json"), "utf-8")) as PilotProduct[];
    expect(merged.some((product) => product.source === "schutz")).toBe(true);
    expect(merged.some((product) => product.productUrl.includes("lexi"))).toBe(true);
    expect(merged.some((product) => product.source === "maison-margiela")).toBe(true);
    await rm(root, { recursive: true, force: true });
  });
});

describe("workflow contract", () => {
  it("does not require OpenAI and keeps onboarding separate from daily refresh", async () => {
    const workflow = await readFile(
      join(process.cwd(), ".github/workflows/capone-brand-onboarding.yml"),
      "utf-8",
    );
    expect(workflow).toContain("cron: \"0 20 * * 0,3\"");
    expect(workflow).toContain("timeout-minutes: 300");
    expect(workflow).toContain("node-version: 20");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).not.toMatch(/OPENAI_API_KEY\s*:/);
    expect(workflow).not.toMatch(/secrets\.OPENAI/);
    const daily = await readFile(join(process.cwd(), ".github/workflows/capone-daily-refresh.yml"), "utf-8");
    expect(daily).toContain("cron: \"0 4 * * 0,3\"");
    expect(daily).toContain('CAPONE_REFRESH_MARKETPLACES: "false"');
  });
});
