const DEDICATED_COUNT =
  /(?:data-filter-product-count|data-product-count|product-count-text)[^>]*>([^<]*)/gi;

const LABELED_COUNT =
  />\s*(\d[\d\s.]*)\s*(?:products?|produits?|productos?)\s*</gi;

function positiveIntegers(value: string): number[] {
  return [...value.matchAll(/(\d[\d\s.]*)/g)]
    .map((match) => Number.parseInt((match[1] ?? "").replace(/[^\d]/g, ""), 10))
    .filter((count) => Number.isFinite(count) && count > 0);
}

/**
 * Customer-facing collection size printed by the official storefront.
 * `collections.json` products_count is not used: it often counts products the
 * public listing does not show. Disagreeing dedicated counters are unknown.
 */
export function parseStorefrontProductCount(html: string): number | null {
  const dedicated = [...html.matchAll(DEDICATED_COUNT)].flatMap((match) =>
    positiveIntegers(match[1] ?? ""),
  );
  const uniqueDedicated = [...new Set(dedicated)];
  if (uniqueDedicated.length === 1) return uniqueDedicated[0] ?? null;
  if (uniqueDedicated.length > 1) return null;

  const labeled = [...html.matchAll(LABELED_COUNT)].map((match) =>
    Number.parseInt((match[1] ?? "").replace(/[^\d]/g, ""), 10),
  ).filter((count) => count > 0);
  const uniqueLabeled = [...new Set(labeled)];
  return uniqueLabeled.length === 1 ? uniqueLabeled[0] ?? null : null;
}

const SWATCH_IMAGE = /swatch|color[-_]?chip|colour[-_]?chip|color[-_]?swatch/i;

export function isColorSwatchImage(url: string): boolean {
  return SWATCH_IMAGE.test(url);
}
