import type { AnalyzedProductInput } from "./types";

const DIVERSITY_TARGETS = [
  "SANDAL",
  "BALLERINA",
  "LOAFER",
  "WEDGE",
  "PUMP",
] as const;

export type DiversityCategory = (typeof DIVERSITY_TARGETS)[number];

export function selectFiveDiverseProducts(
  products: AnalyzedProductInput[],
): AnalyzedProductInput[] {
  const selected: AnalyzedProductInput[] = [];
  const usedBrands = new Set<string>();

  for (const category of DIVERSITY_TARGETS) {
    const candidates = products.filter(
      (p) =>
        p.category === category &&
        p.imageUrl &&
        !selected.some((s) => s.productUrl === p.productUrl),
    );

    const preferred =
      candidates.find((p) => !usedBrands.has(p.brand)) ?? candidates[0];

    if (preferred) {
      selected.push(preferred);
      usedBrands.add(preferred.brand);
    }
  }

  return selected;
}

export { DIVERSITY_TARGETS };
