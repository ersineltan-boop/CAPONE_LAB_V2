import type { MarketResearchBrand } from "../types";

export type RomaniaSourceStatus = "ok" | "source_unavailable" | "partial";

export interface RomaniaSourceCoverage {
  sourceId: string;
  sourceName: string;
  status: RomaniaSourceStatus;
  totalProducts: number | null;
  collectedProducts: number;
  excludedProducts: number;
  missingProducts: number | null;
  coveragePercent: number | null;
  note: string | null;
}

export interface RomaniaRefreshCandidate {
  brand: MarketResearchBrand;
  coverage: RomaniaSourceCoverage;
}

export interface RomaniaRefreshDecision {
  publishable: RomaniaRefreshCandidate[];
  preservedLastGood: MarketResearchBrand[];
  coverage: RomaniaSourceCoverage[];
  complete: boolean;
}

function normalizeImages(images: string[]): string[] {
  return [...new Set(images.map((image) => image.trim()).filter(Boolean))];
}

function preserveVariantImages(
  next: MarketResearchBrand,
  previous: MarketResearchBrand | undefined,
): MarketResearchBrand {
  if (!previous) return next;

  const previousVariants = new Map(
    previous.models.flatMap((model) =>
      model.variants.map((variant) => [`${model.id}::${variant.id}`, variant] as const),
    ),
  );

  return {
    ...next,
    models: next.models.map((model) => ({
      ...model,
      variants: model.variants.map((variant) => {
        const oldVariant = previousVariants.get(`${model.id}::${variant.id}`);
        if (!oldVariant) return variant;
        const nextImages = normalizeImages(variant.images);
        const oldImages = normalizeImages(oldVariant.images);
        return {
          ...variant,
          images: nextImages.length > 0 ? nextImages : oldImages,
          visualStatus:
            nextImages.length > 0 ? variant.visualStatus : oldVariant.visualStatus ?? variant.visualStatus,
          visualNote:
            nextImages.length > 0 ? variant.visualNote : oldVariant.visualNote ?? variant.visualNote,
        };
      }),
    })),
  };
}

export function buildRomaniaCoverage(input: {
  sourceId: string;
  sourceName: string;
  status: RomaniaSourceStatus;
  totalProducts?: number | null;
  collectedProducts: number;
  excludedProducts?: number;
  note?: string | null;
}): RomaniaSourceCoverage {
  const totalProducts = input.totalProducts ?? null;
  const excludedProducts = Math.max(0, input.excludedProducts ?? 0);
  const collectedProducts = Math.max(0, input.collectedProducts);
  const expectedProducts = totalProducts === null ? null : Math.max(0, totalProducts - excludedProducts);
  const missingProducts = expectedProducts === null ? null : Math.max(0, expectedProducts - collectedProducts);
  const coveragePercent =
    expectedProducts === null
      ? null
      : expectedProducts === 0
        ? 100
        : Math.min(100, Math.round((collectedProducts / expectedProducts) * 10_000) / 100);

  return {
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    status: input.status,
    totalProducts,
    collectedProducts,
    excludedProducts,
    missingProducts,
    coveragePercent,
    note: input.note ?? null,
  };
}

function isCoverageComplete(coverage: RomaniaSourceCoverage): boolean {
  if (coverage.status === "source_unavailable") return true;
  if (coverage.status !== "ok") return false;
  if (coverage.totalProducts === null || coverage.missingProducts === null) return false;
  return coverage.missingProducts === 0;
}

export function decideRomaniaRefresh(input: {
  previousBrands: MarketResearchBrand[];
  candidates: RomaniaRefreshCandidate[];
}): RomaniaRefreshDecision {
  const previousById = new Map(input.previousBrands.map((brand) => [brand.id, brand]));
  const publishable: RomaniaRefreshCandidate[] = [];
  const preservedLastGood: MarketResearchBrand[] = [];

  for (const candidate of input.candidates) {
    const previous = previousById.get(candidate.brand.id);
    if (isCoverageComplete(candidate.coverage)) {
      publishable.push({
        ...candidate,
        brand: preserveVariantImages(candidate.brand, previous),
      });
      continue;
    }
    if (previous) preservedLastGood.push(previous);
  }

  const coverage = input.candidates.map((candidate) => candidate.coverage);
  return {
    publishable,
    preservedLastGood,
    coverage,
    complete: coverage.every(isCoverageComplete),
  };
}
