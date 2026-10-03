import { loadModelFamilies } from "../../modelFamily/dataset";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { loadAdapterFile } from "../../onboarding/adapterStore";
import { loadQueueFile } from "../../onboarding/queue";
import type { BrandUniverseFile } from "../../registry/build/types";
import { fullCatalogPassBlocker } from "../wave50/coverage";
import { mapPool } from "../wave50/pool";
import {
  applyPassedBrandsToUniverse,
  atomicWriteJson,
  publishLastGoodCatalog,
  readJsonFile,
  sameCatalogPayload,
  stageCatalog,
  WAVE_LAST_GOOD_DIR,
} from "../wave50/publish";
import { collectShopifyWomensCatalog } from "../wave50/shopifyAdapter";
import type { WaveCatalog, WaveHttp } from "../wave50/types";
import {
  applySourceAwareBrandReplacement,
  prepareBrandDelivery,
  waveProductNewness,
  replaceAutomationBrandDeliveries,
  type BrandDeliveryReplacement,
} from "./delivery";
import { buildBrandAutomationPlan, type BrandAutomationCandidate } from "./plan";

export const BRAND_AUTOMATION_REPORT_PATH = "data/registry/brand-automation-report.json";
export const BRAND_AUTOMATION_CONCURRENCY = 10;

export type BrandAutomationStatus =
  | "FULL_PUBLISHED"
  | "FULL_NO_CHANGE"
  | "DRY_RUN_FULL"
  | "SOURCE_OR_COVERAGE_BLOCKED"
  | "TAXONOMY_BLOCKED"
  | "LAST_GOOD_BLOCKED";

export interface BrandAutomationOutcome {
  slug: string;
  brand: string;
  origin: BrandAutomationCandidate["origin"];
  status: BrandAutomationStatus;
  blocker: string | null;
  collected: number;
  families: number;
  deliveryFamilies: number;
  unresolvedFamilies: number;
  catalogDiffNewProducts: number;
  baselineProtected: boolean;
  lastGoodChanged: boolean;
  lastGoodRetained: boolean;
}

export interface BrandAutomationReport {
  version: 1;
  generatedAt: string;
  dryRun: boolean;
  candidates: number;
  skipped: Array<{ slug: string; reason: string }>;
  summary: {
    full: number;
    changed: number;
    unchanged: number;
    blocked: number;
    deliveryFamiliesReplaced: number;
    activated: number;
  };
  outcomes: BrandAutomationOutcome[];
}

export interface BrandAutomationOptions {
  root: string;
  http: WaveHttp;
  now?: string;
  dryRun?: boolean;
  refreshOnly?: boolean;
  only?: readonly string[];
  limit?: number;
  concurrency?: number;
}

async function lastGoodSlugs(root: string): Promise<Set<string>> {
  try {
    const files = await readdir(join(root, WAVE_LAST_GOOD_DIR));
    return new Set(
      files.filter((file) => file.endsWith(".json")).map((file) => file.replace(/\.json$/, "")),
    );
  } catch {
    return new Set();
  }
}

async function deliveredBrandSlugs(root: string): Promise<Set<string>> {
  const manifest = await readJsonFile<{ shards?: Array<{ file?: string }> } | null>(
    join(root, "data/multibrand/model-families/manifest.json"),
    null,
  );
  return new Set(
    (manifest?.shards ?? [])
      .map((shard) => shard.file ?? "")
      .filter((file) => /^brands\/[a-z0-9-]+\.json$/.test(file))
      .map((file) => file.slice("brands/".length, -".json".length)),
  );
}

function baselineDiffCount(catalog: WaveCatalog): number {
  return catalog.families.reduce(
    (sum, family) =>
      sum + family.variants.filter((variant) => variant.newnessEvidence === "CATALOG_DIFF").length,
    0,
  );
}

function blockedOutcome(
  candidate: BrandAutomationCandidate,
  status: BrandAutomationStatus,
  blocker: string,
  catalog: WaveCatalog | null,
  extra: Partial<BrandAutomationOutcome> = {},
): BrandAutomationOutcome {
  return {
    slug: candidate.slug,
    brand: candidate.brand,
    origin: candidate.origin,
    status,
    blocker,
    collected: catalog?.coverage.collected ?? 0,
    families: catalog?.families.length ?? 0,
    deliveryFamilies: 0,
    unresolvedFamilies: 0,
    catalogDiffNewProducts: catalog ? baselineDiffCount(catalog) : 0,
    baselineProtected: false,
    lastGoodChanged: false,
    lastGoodRetained: true,
    ...extra,
  };
}

/**
 * Deterministic official-brand refresh. A candidate reaches last-good and UI
 * delivery only after FULL coverage and taxonomy gates both pass.
 */
export async function runBrandAutomation(
  options: BrandAutomationOptions,
): Promise<BrandAutomationReport> {
  const now = options.now ?? new Date().toISOString();
  const dryRun = options.dryRun ?? false;
  const universe = await readJsonFile<BrandUniverseFile>(
    join(options.root, "data/registry/brand-universe.json"),
    { version: 1, brands: [] },
  );
  const plan = buildBrandAutomationPlan({
    universe,
    queue: await loadQueueFile(options.root),
    adapters: await loadAdapterFile(options.root),
    lastGoodSlugs: await lastGoodSlugs(options.root),
    only: options.only,
    refreshOnly: options.refreshOnly,
    limit: options.limit,
  });
  const delivered = await deliveredBrandSlugs(options.root);
  const existingFamilies = await loadModelFamilies({ rootDir: join(options.root, "data/multibrand") });

  const results = await mapPool(
    plan.candidates,
    options.concurrency ?? BRAND_AUTOMATION_CONCURRENCY,
    async (candidate): Promise<{
      outcome: BrandAutomationOutcome;
      delivery: BrandDeliveryReplacement | null;
      activation: WaveCatalog | null;
    }> => {
      const previousPath = join(options.root, WAVE_LAST_GOOD_DIR, `${candidate.slug}.json`);
      const previous = await readJsonFile<WaveCatalog | null>(previousPath, null);
      try {
        const collected = await collectShopifyWomensCatalog({
          seed: candidate,
          http: options.http,
          now,
          previousUrls: previous ? new Set(previous.productUrls) : null,
        });
        if (collected.catalog) await stageCatalog(options.root, collected.catalog);
        const catalog = collected.catalog;
        const coverageBlocker = collected.blocker ?? (
          collected.coverage ? fullCatalogPassBlocker(collected.coverage) : "EMPTY_OR_FAILED_COLLECT"
        );
        if (!catalog || coverageBlocker) {
          return {
            outcome: blockedOutcome(
              candidate,
              "SOURCE_OR_COVERAGE_BLOCKED",
              coverageBlocker ?? "EMPTY_OR_FAILED_COLLECT",
              catalog,
              { lastGoodRetained: previous !== null },
            ),
            delivery: null,
            activation: null,
          };
        }

        const diffNew = baselineDiffCount(catalog);
        if (!previous && diffNew > 0) {
          return {
            outcome: blockedOutcome(
              candidate,
              "SOURCE_OR_COVERAGE_BLOCKED",
              "BASELINE_CATALOG_DIFF_NEWNESS_NOT_ALLOWED",
              catalog,
              { catalogDiffNewProducts: diffNew, baselineProtected: true, lastGoodRetained: false },
            ),
            delivery: null,
            activation: null,
          };
        }

        const changed = !previous || !sameCatalogPayload(previous, catalog);
        // Reconfirm source evidence even when products and galleries did not change.
        const needsDelivery = changed || !delivered.has(candidate.slug) || previous?.collectedAt !== now;
        const prepared = needsDelivery
          ? await prepareBrandDelivery({ catalog, http: options.http, previousFamilies: existingFamilies })
          : { families: [], unresolved: [] };
        if (prepared.unresolved.length > 0) {
          return {
            outcome: blockedOutcome(candidate, "TAXONOMY_BLOCKED", "UNCLASSIFIED_FAMILIES", catalog, {
              catalogDiffNewProducts: diffNew,
              baselineProtected: previous === null,
              unresolvedFamilies: prepared.unresolved.length,
              lastGoodRetained: previous !== null,
            }),
            delivery: null,
            activation: null,
          };
        }

        // Reject ambiguous identity before advancing last-good or writing any delivery.
        if (needsDelivery) applySourceAwareBrandReplacement(existingFamilies, {
          slug: candidate.slug,
          brand: candidate.brand,
          officialUrl: catalog.officialUrl,
          collectedAt: now,
          families: prepared.families,
          productNewness: waveProductNewness(catalog),
        });

        if (dryRun) {
          return {
            outcome: {
              slug: candidate.slug,
              brand: candidate.brand,
              origin: candidate.origin,
              status: "DRY_RUN_FULL",
              blocker: null,
              collected: catalog.coverage.collected,
              families: catalog.families.length,
              deliveryFamilies: prepared.families.length,
              unresolvedFamilies: 0,
              catalogDiffNewProducts: diffNew,
              baselineProtected: previous === null,
              lastGoodChanged: changed,
              lastGoodRetained: previous !== null,
            },
            delivery: null,
            activation: null,
          };
        }

        const publication = await publishLastGoodCatalog(options.root, catalog);
        if (!publication.published) {
          return {
            outcome: blockedOutcome(
              candidate,
              "LAST_GOOD_BLOCKED",
              publication.blocker ?? "LAST_GOOD_REJECTED",
              catalog,
              {
                catalogDiffNewProducts: diffNew,
                baselineProtected: previous === null,
                lastGoodRetained: publication.retained,
              },
            ),
            delivery: null,
            activation: null,
          };
        }

        return {
          outcome: {
            slug: candidate.slug,
            brand: candidate.brand,
            origin: candidate.origin,
            status: publication.changed ? "FULL_PUBLISHED" : "FULL_NO_CHANGE",
            blocker: null,
            collected: catalog.coverage.collected,
            families: catalog.families.length,
            deliveryFamilies: prepared.families.length,
            unresolvedFamilies: 0,
            catalogDiffNewProducts: diffNew,
            baselineProtected: previous === null,
            lastGoodChanged: publication.changed,
            lastGoodRetained: publication.retained,
          },
          delivery: needsDelivery
            ? {
                slug: candidate.slug,
                brand: candidate.brand,
                officialUrl: catalog.officialUrl,
                collectedAt: now,
                families: prepared.families,
                productNewness: waveProductNewness(catalog),
              }
            : null,
          activation:
            candidate.origin === "APPROVED_QUEUE" || !candidate.wasActive ? catalog : null,
        };
      } catch (error) {
        return {
          outcome: blockedOutcome(
            candidate,
            "SOURCE_OR_COVERAGE_BLOCKED",
            error instanceof Error ? error.message : String(error),
            null,
            { lastGoodRetained: previous !== null },
          ),
          delivery: null,
          activation: null,
        };
      }
    },
  );

  const deliveries = results.flatMap((result) => result.delivery ? [result.delivery] : []);
  const deliveryFamiliesReplaced = dryRun
    ? 0
    : await replaceAutomationBrandDeliveries({ root: options.root, deliveries, generatedAt: now });
  const activations = results.flatMap((result) => result.activation ? [result.activation] : []);
  const activationResult = dryRun
    ? { updated: 0, errors: [] as string[] }
    : await applyPassedBrandsToUniverse(options.root, activations);
  if (activationResult.errors.length > 0) {
    throw new Error(`Brand universe activation failed: ${activationResult.errors.join("; ")}`);
  }

  const outcomes = results.map((result) => result.outcome);
  const report: BrandAutomationReport = {
    version: 1,
    generatedAt: now,
    dryRun,
    candidates: plan.candidates.length,
    skipped: plan.skipped,
    summary: {
      full: outcomes.filter((outcome) =>
        outcome.status === "FULL_PUBLISHED" ||
        outcome.status === "FULL_NO_CHANGE" ||
        outcome.status === "DRY_RUN_FULL",
      ).length,
      changed: outcomes.filter((outcome) => outcome.lastGoodChanged).length,
      unchanged: outcomes.filter((outcome) => outcome.status === "FULL_NO_CHANGE").length,
      blocked: outcomes.filter((outcome) => outcome.blocker !== null).length,
      deliveryFamiliesReplaced,
      activated: activationResult.updated,
    },
    outcomes,
  };
  await atomicWriteJson(join(options.root, BRAND_AUTOMATION_REPORT_PATH), report);
  return report;
}
