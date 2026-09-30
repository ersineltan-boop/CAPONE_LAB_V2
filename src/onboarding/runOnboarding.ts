import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { PilotProduct } from "../collector/types";
import type { BrandUniverseFile } from "../registry/build/types";
import {
  ONBOARDING_MAX_ACTIVATIONS_PER_RUN,
  REPORT_PATH,
  UNIVERSE_PATH,
  retryAt,
} from "./policy";
import {
  blockedDoesNotConsumeActivationQuota,
  loadQueueFile,
  mergeQueueWithUniverseCandidates,
  remainingActivationSlots,
  saveQueueFile,
  selectQueueCandidates,
  updateQueueEntry,
} from "./queue";
import { probeBrandSource } from "./probe";
import { collectCandidateToStaging } from "./collect";
import { evaluateOfficialSourceCoverage, evaluateQualityGate } from "./validate";
import { cleanupStaging, probeSamplesToPilotProducts, writeStaging } from "./staging";
import { marketplaceCoverageForBrand } from "./marketplaceCoverage";
import { activateUniverseBrand, mergeValidatedBrandIntoCatalog, prepareFirstBrandBaseline, rebuildCatalogAfterActivation } from "./activate";
import { inspectTrackedFileSizes } from "./publish";
import { createBudgetedProbeHttp, defaultOnboardingHttp, type OnboardingHttp } from "./http";
import type {
  BrandOnboardingAttemptReport,
  BrandOnboardingReportFile,
  OnboardingAdapterConfig,
  OnboardingRunOptions,
  OnboardingStatus,
} from "./types";

export interface OnboardingRunResult {
  report: BrandOnboardingReportFile;
  activated: string[];
  attempted: string[];
}

async function loadJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export async function runBrandOnboarding(
  root: string,
  options: OnboardingRunOptions,
  http: OnboardingHttp = defaultOnboardingHttp,
): Promise<OnboardingRunResult> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun === true;
  const maxActivations = dryRun ? 0 : (options.maxActivations ?? ONBOARDING_MAX_ACTIVATIONS_PER_RUN);
  const universe = await loadJson<BrandUniverseFile>(join(root, UNIVERSE_PATH), {
    version: 1,
    brands: [],
  });
  let queue = mergeQueueWithUniverseCandidates(await loadQueueFile(root), universe.brands, now);
  // The universe is the source of truth for activation. The registry only contains
  // collectors that are already wired into the legacy catalog, so using it here
  // under-reports active brands after successful onboarding waves.
  const activeBefore = universe.brands.filter((entry) => entry.isActive).length;
  const catalogProducts = dryRun
    ? await loadJson<PilotProduct[]>(join(root, "data/multibrand/products.json"), [])
    : [];

  const candidates = selectQueueCandidates(queue, {
    now,
    limit: options.limit,
    only: options.only,
    skipSlugs: new Set(
      universe.brands.filter((entry) => entry.isActive).map((entry) => entry.id),
    ),
  });

  const attempts: BrandOnboardingAttemptReport[] = [];
  const attempted: string[] = [];
  const activated: string[] = [];
  let activatedCount = 0;

  for (const candidate of candidates) {
    attempted.push(candidate.slug);
    queue = updateQueueEntry(queue, candidate.slug, {
      status: "PROBING",
      lastAttemptAt: now.toISOString(),
      attempts: candidate.attempts + 1,
    }, now);

    const sourceUrl = candidate.sourceUrl ?? universe.brands.find((entry) => entry.id === candidate.slug)?.officialUrl;
    if (!sourceUrl) {
      queue = updateQueueEntry(queue, candidate.slug, {
        status: "FAILED",
        blocker: "officialUrl missing",
        nextRetryAt: retryAt(now),
      }, now);
      attempts.push(attemptReport(candidate.brand, candidate.slug, now, {
        status: "FAILED",
        blocker: "officialUrl missing",
        activationDecision: "skip",
      }));
      continue;
    }

    let probe;
    try {
      probe = await probeBrandSource({
        slug: candidate.slug,
        brand: candidate.brand,
        sourceUrl,
        http: createBudgetedProbeHttp(http),
      });
    } catch (error) {
      probe = {
        platform: "UNKNOWN" as const,
        strategy: "none" as const,
        status: "PRIORITY_BLOCKED" as const,
        sourceUrl,
        collectionPaths: [],
        footwearPaths: [],
        products: [],
        blocker: error instanceof Error ? error.message : String(error),
        notes: "Probe threw; recorded as blocked and continuing",
      };
    }

    const marketplace = marketplaceCoverageForBrand(
      catalogProducts.length ? catalogProducts : await loadJson<PilotProduct[]>(join(root, "data/multibrand/products.json"), []),
      candidate.brand,
    );

    if (probe.status === "PRIORITY_BLOCKED" || probe.status === "CUSTOM_ADAPTER_REQUIRED" || probe.status === "FAILED") {
      queue = updateQueueEntry(queue, candidate.slug, {
        status: probe.status,
        detectedPlatform: probe.platform,
        collectorStrategy: probe.strategy,
        blocker: probe.blocker,
        productsFound: probe.products.length,
        nextRetryAt: retryAt(now),
        notes: marketplaceNote(probe.blocker, marketplace),
      }, now);
      attempts.push(attemptReport(candidate.brand, candidate.slug, now, {
        status: probe.status,
        detectedPlatform: probe.platform,
        sourceStrategy: probe.strategy,
        productsFound: probe.products.length,
        blocker: probe.blocker,
        marketplaceCoverage: marketplace,
        activationDecision: "blocked",
        notes: probe.notes,
      }));
      continue;
    }

    let products = probeSamplesToPilotProducts({
      slug: candidate.slug,
      brand: candidate.brand,
      probe,
    });
    let coverageEvidence = {
      errors: ["full collection was not executed"],
      paginationExhausted: false,
      rawProductUrlsDiscovered: 0,
      sourceReportedProductCount: null as number | null,
      hitCollectionCrawlCap: false,
    };
    if (!dryRun && probe.strategy !== "none") {
      const collected = await collectCandidateToStaging({
        slug: candidate.slug,
        brand: candidate.brand,
        sourceUrl,
        probe,
        http,
      });
      if (collected.products.length > 0) products = collected.products;
      coverageEvidence = {
        errors: collected.errors,
        paginationExhausted: collected.paginationExhausted,
        rawProductUrlsDiscovered: collected.rawProductUrlsDiscovered,
        sourceReportedProductCount: collected.sourceReportedProductCount,
        hitCollectionCrawlCap: collected.hitCollectionCrawlCap,
      };
    }

    await writeStaging(root, {
      slug: candidate.slug,
      brand: candidate.brand,
      probedAt: now.toISOString(),
      probe,
      products,
    });

    queue = updateQueueEntry(queue, candidate.slug, { status: "VALIDATING" }, now);
    const quality = evaluateQualityGate(products);
    const coverage = evaluateOfficialSourceCoverage({
      ...coverageEvidence,
      acceptedProductCount: new Set(products.map((product) => product.productUrl)).size,
    });
    console.log(`[onboarding] ${candidate.slug}: ${quality.decisionLog}`);

    if (!quality.ok || products.length === 0) {
      await cleanupStaging(root, candidate.slug);
      const status: OnboardingStatus = products.length === 0 ? (probe.status === "VALIDATING" ? "CUSTOM_ADAPTER_REQUIRED" : probe.status) : "FAILED";
      queue = updateQueueEntry(queue, candidate.slug, {
        status,
        detectedPlatform: probe.platform,
        collectorStrategy: probe.strategy,
        blocker: quality.reasons.join("; ") || probe.blocker,
        productsFound: products.length,
        nextRetryAt: retryAt(now),
        notes: marketplaceNote(quality.reasons.join("; "), marketplace),
      }, now);
      attempts.push(attemptReport(candidate.brand, candidate.slug, now, {
        status,
        detectedPlatform: probe.platform,
        sourceStrategy: probe.strategy,
        productsFound: products.length,
        families: quality.families,
        realMultiColorFamilies: quality.multiColorFamilies,
        verifiedNewArrivals: quality.verifiedNewArrivals,
        galleryImageCoverage: quality.galleryCoverage,
        categoriesFound: quality.categories,
        blocker: quality.reasons.join("; ") || probe.blocker,
        marketplaceCoverage: marketplace,
        activationDecision: "skip",
        notes: `${probe.notes ?? ""}; ${quality.decisionLog}`.trim(),
      }));
      continue;
    }

    const completenessStatus: OnboardingStatus =
      quality.completeness === "FULL" && coverage.full ? "READY" : "PARTIAL";
    const adapter: OnboardingAdapterConfig = {
      platform: probe.platform,
      strategy: probe.strategy === "none" ? "structured-data" : probe.strategy,
      sourceUrl,
      locale: probe.locale,
      collectionPaths: probe.collectionPaths,
      footwearPaths: probe.footwearPaths,
    };

    // PARTIAL brands stay staged for manual review — do not auto-merge into live catalog.
    if (quality.completeness !== "FULL" || !coverage.full) {
      const blocker = coverage.full
        ? `Katalog eksik: ${products.length} ürün (en az 20), çoklu görsel kapsamı %${Math.round(quality.galleryCoverage * 100)} (en az %40)`
        : coverage.reasons.join("; ");
      const coverageNote = coverage.full
        ? quality.decisionLog
        : `${quality.decisionLog}; coverage not FULL: ${coverage.reasons.join("; ")}`;
      queue = updateQueueEntry(queue, candidate.slug, {
        status: "PARTIAL",
        detectedPlatform: probe.platform,
        collectorStrategy: probe.strategy,
        blocker,
        productsFound: products.length,
        nextRetryAt: retryAt(now),
        notes: coverageNote,
      }, now);
      attempts.push(attemptReport(candidate.brand, candidate.slug, now, {
        status: "PARTIAL",
        detectedPlatform: probe.platform,
        sourceStrategy: probe.strategy,
        productsFound: products.length,
        families: quality.families,
        realMultiColorFamilies: quality.multiColorFamilies,
        verifiedNewArrivals: quality.verifiedNewArrivals,
        galleryImageCoverage: quality.galleryCoverage,
        categoriesFound: quality.categories,
        blocker,
        marketplaceCoverage: marketplace,
        activationDecision: "partial",
        notes: coverageNote,
      }));
      continue;
    }

    const slots = remainingActivationSlots(maxActivations, activatedCount);
    const canActivate = !dryRun && slots > 0;
    if (canActivate) {
      const storage = await inspectTrackedFileSizes(root);
      if (storage.storageStatus === "STORAGE_LIMIT") {
        queue = updateQueueEntry(queue, candidate.slug, {
          status: "STORAGE_LIMIT",
          blocker: "products.json or analyzed-products.json would exceed the 90 MB safety limit",
          productsFound: products.length,
          detectedPlatform: probe.platform,
          collectorStrategy: probe.strategy,
        }, now);
        attempts.push(attemptReport(candidate.brand, candidate.slug, now, {
          status: "STORAGE_LIMIT",
          detectedPlatform: probe.platform,
          sourceStrategy: probe.strategy,
          productsFound: products.length,
          blocker: "STORAGE_LIMIT",
          activationDecision: "blocked",
        }));
        await cleanupStaging(root, candidate.slug);
        break;
      }
      await mergeValidatedBrandIntoCatalog({
        root,
        slug: candidate.slug,
        products: prepareFirstBrandBaseline(products),
        status: "success",
      });
      await activateUniverseBrand({ root, slug: candidate.slug, adapter, quality, now });
      await rebuildCatalogAfterActivation(root);
      activatedCount += 1;
      activated.push(candidate.slug);
      queue = updateQueueEntry(queue, candidate.slug, {
        status: "ACTIVE",
        detectedPlatform: probe.platform,
        collectorStrategy: probe.strategy,
        blocker: null,
        productsFound: products.length,
        activatedAt: now.toISOString(),
        nextRetryAt: null,
        notes: quality.decisionLog,
      }, now);
      attempts.push(attemptReport(candidate.brand, candidate.slug, now, {
        status: "ACTIVE",
        detectedPlatform: probe.platform,
        sourceStrategy: probe.strategy,
        productsFound: products.length,
        families: quality.families,
        realMultiColorFamilies: quality.multiColorFamilies,
        verifiedNewArrivals: quality.verifiedNewArrivals,
        galleryImageCoverage: quality.galleryCoverage,
        categoriesFound: quality.categories,
        blocker: null,
        marketplaceCoverage: marketplace,
        activationDecision: "activate",
        notes: quality.decisionLog,
      }));
    } else {
      queue = updateQueueEntry(queue, candidate.slug, {
        status: completenessStatus,
        detectedPlatform: probe.platform,
        collectorStrategy: probe.strategy,
        blocker: null,
        productsFound: products.length,
        notes: dryRun ? `dry-run; not activated; ${quality.decisionLog}` : `ready but activation quota reached; ${quality.decisionLog}`,
      }, now);
      attempts.push(attemptReport(candidate.brand, candidate.slug, now, {
        status: completenessStatus,
        detectedPlatform: probe.platform,
        sourceStrategy: probe.strategy,
        productsFound: products.length,
        families: quality.families,
        realMultiColorFamilies: quality.multiColorFamilies,
        verifiedNewArrivals: quality.verifiedNewArrivals,
        galleryImageCoverage: quality.galleryCoverage,
        categoriesFound: quality.categories,
        blocker: null,
        marketplaceCoverage: marketplace,
        activationDecision: dryRun ? "dry-run" : "skip",
        notes: probe.notes,
      }));
    }

    await cleanupStaging(root, candidate.slug);
    if (blockedDoesNotConsumeActivationQuota(probe.status)) {
      continue;
    }
  }

  await cleanupStaging(root);
  await saveQueueFile(root, queue);

  const activeAfter = dryRun ? activeBefore : activeBefore + activated.length;
  const report: BrandOnboardingReportFile = {
    version: 1,
    generatedAt: now.toISOString(),
    dryRun,
    summary: {
      activeBrandsBefore: activeBefore,
      activeBrandsAfter: activeAfter,
      attempted: attempted.length,
      activated: activated.length,
      partial: attempts.filter((item) => item.status === "PARTIAL").length,
      blocked: attempts.filter((item) =>
        item.status === "BLOCKED" || item.status === "PRIORITY_BLOCKED",
      ).length,
      customAdapterRequired: attempts.filter((item) => item.status === "CUSTOM_ADAPTER_REQUIRED").length,
      failed: attempts.filter((item) => item.status === "FAILED").length,
      storageStatus: (await inspectTrackedFileSizes(root)).storageStatus,
    },
    attempts,
  };
  const reportPath = join(root, REPORT_PATH);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");
  return { report, activated, attempted };
}

function marketplaceNote(
  blocker: string | null,
  coverage: { farfetch: number; levelShoes: number },
): string | null {
  if (coverage.farfetch === 0 && coverage.levelShoes === 0) return blocker;
  return `${blocker ?? "official source unavailable"}; marketplace coverage exists (Farfetch ${coverage.farfetch}, Level Shoes ${coverage.levelShoes}) but is not an official brand source`;
}

function attemptReport(
  brand: string,
  slug: string,
  now: Date,
  rest: Partial<BrandOnboardingAttemptReport> & Pick<BrandOnboardingAttemptReport, "status" | "activationDecision">,
): BrandOnboardingAttemptReport {
  return {
    brand,
    slug,
    attemptedAt: now.toISOString(),
    detectedPlatform: rest.detectedPlatform ?? null,
    sourceStrategy: rest.sourceStrategy ?? null,
    status: rest.status,
    productsFound: rest.productsFound ?? 0,
    families: rest.families ?? null,
    realMultiColorFamilies: rest.realMultiColorFamilies ?? null,
    verifiedNewArrivals: rest.verifiedNewArrivals ?? null,
    galleryImageCoverage: rest.galleryImageCoverage ?? null,
    categoriesFound: rest.categoriesFound ?? [],
    blocker: rest.blocker ?? null,
    marketplaceCoverage: rest.marketplaceCoverage ?? null,
    activationDecision: rest.activationDecision,
    notes: rest.notes ?? null,
  };
}
