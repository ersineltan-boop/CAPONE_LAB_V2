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
  if (uniqueLabeled.length === 1) return uniqueLabeled[0] ?? null;
  if (uniqueLabeled.length > 1) return null;

  const results = [...html.matchAll(/>\s*Show\s+(\d[\d\s,]*)\s+results\s*</gi)]
    .map((match) => Number((match[1] ?? "").replace(/[^\d]/g, "")))
    .filter((count) => count > 0);
  const uniqueResults = [...new Set(results)];
  if (uniqueResults.length === 1) return uniqueResults[0] ?? null;
  if (uniqueResults.length > 1) return null;

  const facet = [...html.matchAll(/productcount[^>]*>\s*\(\s*(\d[\d\s.]*)\s*\)/gi)].map((match) =>
    Number.parseInt((match[1] ?? "").replace(/[^\d]/g, ""), 10),
  ).filter((count) => count > 0);
  const uniqueFacet = [...new Set(facet)];
  return uniqueFacet.length === 1 ? uniqueFacet[0] ?? null : null;
}

const SWATCH_IMAGE = /swatch|color[-_]?chip|colour[-_]?chip|color[-_]?swatch/i;

export function isColorSwatchImage(url: string): boolean {
  return SWATCH_IMAGE.test(url);
}
