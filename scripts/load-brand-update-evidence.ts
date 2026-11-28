import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { decideLastGoodPublish } from "../src/brands/wave50/lastGood";
import type { WaveCatalog } from "../src/brands/wave50/types";
import type { BrandUpdateEvidence, CatalogShard } from "../src/catalog/types";

type BrandCoverage = NonNullable<CatalogShard["coverage"]>;

type PriorityCoverage = BrandCoverage & {
  updatedAt?: string;
  totalKnown?: boolean;
  quarantined?: number;
};

interface BataDeliveryProof {
  checkedAt: string;
  sourceRows: number;
  footwear: number;
  families: number;
  excludedIds: string[];
  release?: {
    productionReady: boolean;
    liveFamilies: number;
    liveVariants: number;
  };
}

async function readOptionalJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function evidenceDate(value: unknown): string | undefined {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) ||
      !Number.isFinite(Date.parse(value))) {
    return undefined;
  }
  const day = value.slice(0, 10);
  return new Date(`${day}T00:00:00Z`).toJSON()?.slice(0, 10) === day ? value : undefined;
}

function latestEvidence(dates: Array<string | undefined>): string | undefined {
  return dates.reduce<string | undefined>((latest, date) =>
    date && (!latest || Date.parse(date) > Date.parse(latest)) ? date : latest,
  undefined);
}

function normalizePriorityCoverage(value: PriorityCoverage | undefined): BrandCoverage | undefined {
  if (value?.status !== "FULL" && value?.status !== "PARTIAL") return undefined;
  if (!Number.isSafeInteger(value.ready) || value.ready < 0 ||
      !Number.isSafeInteger(value.pending) || value.pending < 0) return undefined;
  return {
    ...value,
    lastVerifiedAt: latestEvidence([evidenceDate(value.lastVerifiedAt), evidenceDate(value.updatedAt)]),
  };
}

function waveVerification(brandId: string, catalog: WaveCatalog | undefined): string | undefined {
  const collectedAt = evidenceDate(catalog?.collectedAt);
  if (!catalog || !collectedAt || catalog.slug !== brandId || !Array.isArray(catalog.productUrls)) return undefined;
  const coverage = catalog.coverage;
  if (coverage?.sampleOnly !== false || coverage.paginationExhausted !== true ||
      coverage.taxonomyPassed !== true || coverage.womenFootwearOnly !== true ||
      coverage.collected !== catalog.productUrls.length) return undefined;

  const decision = decideLastGoodPublish({
    previousCollected: null,
    candidate: catalog,
    coverage,
    referenceFootwearTotal: catalog.referenceFootwearTotal,
    referenceNewArrivals: catalog.referenceNewArrivals,
    newArrivalsFootwear: catalog.newArrivalsFootwear,
  });
  return decision.publish ? collectedAt : undefined;
}

function bataVerification(proof: BataDeliveryProof | undefined): string | undefined {
  if (proof?.release?.productionReady !== true ||
      !Number.isSafeInteger(proof.footwear) || proof.footwear <= 0 ||
      !Number.isSafeInteger(proof.families) || proof.families <= 0 ||
      !Array.isArray(proof.excludedIds) || proof.sourceRows !== proof.footwear + proof.excludedIds.length ||
      proof.release.liveFamilies !== proof.families || proof.release.liveVariants !== proof.footwear) {
    return undefined;
  }
  return evidenceDate(proof.checkedAt);
}

export async function loadBrandUpdateEvidence(
  root: string,
  activeBrandIds: readonly string[],
): Promise<Map<string, BrandUpdateEvidence>> {
  const [priority, bataProof] = await Promise.all([
    readOptionalJson<Record<string, PriorityCoverage>>(join(root, "data/registry/priority-brand-coverage.json")),
    activeBrandIds.includes("bata")
      ? readOptionalJson<BataDeliveryProof>(join(root, "data/registry/bata-delivery-proof.json"))
      : undefined,
  ]);
  const entries = await Promise.all(activeBrandIds.map(async (id) => {
    const coverage = normalizePriorityCoverage(priority?.[id]);
    const wave = await readOptionalJson<WaveCatalog>(join(root, "data/brands/wave50/last-good", `${id}.json`));
    const verifiedAt = latestEvidence([
      coverage?.lastVerifiedAt,
      waveVerification(id, wave),
      id === "bata" ? bataVerification(bataProof) : undefined,
    ]);
    return [id, { verifiedAt, coverage }] as const;
  }));
  return new Map(entries.filter(([, value]) => value.verifiedAt || value.coverage));
}
