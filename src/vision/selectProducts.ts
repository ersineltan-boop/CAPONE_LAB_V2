import type { AnalyzedProductInput } from "./types";
import {
  BRAND_TARGETS,
  PRODUCTS_PER_BRAND,
  type VisionProductRecord,
} from "./types";

const PRIORITY_CATEGORIES = [
  "SANDAL",
  "PUMP",
  "BALLERINA",
  "LOAFER",
  "MULE",
  "THONG",
  "WEDGE",
  "SLINGBACK",
  "BOOT",
  "SNEAKER",
] as const;

function successfulRecords(existing: VisionProductRecord[]): VisionProductRecord[] {
  return existing.filter((record) => !record.error);
}

function countSuccessfulByBrand(existing: VisionProductRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const brand of BRAND_TARGETS) {
    counts.set(brand, 0);
  }
  for (const record of successfulRecords(existing)) {
    counts.set(record.brand, (counts.get(record.brand) ?? 0) + 1);
  }
  return counts;
}

function pickDiverseProducts(
  candidates: AnalyzedProductInput[],
  count: number,
): AnalyzedProductInput[] {
  if (count <= 0) return [];

  const picked: AnalyzedProductInput[] = [];
  const usedUrls = new Set<string>();
  const usedCategories = new Set<string>();

  const take = (product: AnalyzedProductInput | undefined) => {
    if (!product || usedUrls.has(product.productUrl)) return;
    picked.push(product);
    usedUrls.add(product.productUrl);
    if (product.category) usedCategories.add(product.category);
  };

  for (const category of PRIORITY_CATEGORIES) {
    if (picked.length >= count) break;
    take(candidates.find((p) => p.category === category && !usedUrls.has(p.productUrl)));
  }

  for (const product of candidates) {
    if (picked.length >= count) break;
    if (usedUrls.has(product.productUrl)) continue;
    if (product.category && !usedCategories.has(product.category)) {
      take(product);
    }
  }

  for (const product of candidates) {
    if (picked.length >= count) break;
    take(product);
  }

  return picked;
}

export function selectPilotProducts(
  products: AnalyzedProductInput[],
  existing: VisionProductRecord[] = [],
): AnalyzedProductInput[] {
  const successfulUrls = new Set(
    successfulRecords(existing).map((record) => record.productUrl),
  );
  const successfulByBrand = countSuccessfulByBrand(existing);
  const selected: AnalyzedProductInput[] = [];

  for (const brand of BRAND_TARGETS) {
    const alreadyDone = successfulByBrand.get(brand) ?? 0;
    const needed = PRODUCTS_PER_BRAND - alreadyDone;
    if (needed <= 0) continue;

    const candidates = products.filter(
      (product) =>
        product.brand === brand &&
        product.imageUrl &&
        !successfulUrls.has(product.productUrl) &&
        !selected.some((item) => item.productUrl === product.productUrl),
    );

    selected.push(...pickDiverseProducts(candidates, needed));
  }

  return selected;
}

export function getPilotCohortProducts(
  products: AnalyzedProductInput[],
  existing: VisionProductRecord[] = [],
): AnalyzedProductInput[] {
  const successfulUrls = new Set(
    successfulRecords(existing).map((record) => record.productUrl),
  );
  const fromExisting = products.filter((product) => successfulUrls.has(product.productUrl));
  const pending = selectPilotProducts(products, existing);
  const cohortUrls = new Set<string>();

  const cohort: AnalyzedProductInput[] = [];
  for (const product of [...fromExisting, ...pending]) {
    if (cohortUrls.has(product.productUrl)) continue;
    cohortUrls.add(product.productUrl);
    cohort.push(product);
  }

  return cohort;
}

export function countRemainingSlots(
  products: AnalyzedProductInput[],
  existing: VisionProductRecord[],
): number {
  const needed = BRAND_TARGETS.length * PRODUCTS_PER_BRAND;
  const alreadyDone = successfulRecords(existing).length;
  const pending = selectPilotProducts(products, existing).length;
  return Math.min(needed - alreadyDone, pending);
}
