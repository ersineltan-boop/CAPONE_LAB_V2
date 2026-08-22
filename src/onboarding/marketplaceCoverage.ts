const MARKETPLACE_SOURCES = new Set(["farfetch", "level-shoes"]);

export function marketplaceCoverageForBrand(
  products: readonly { source: string; brand: string }[],
  brandName: string,
): { farfetch: number; levelShoes: number } {
  const needle = brandName.trim().toUpperCase().replace(/\s+SHOEMAKERS$/, "");
  let farfetch = 0;
  let levelShoes = 0;
  for (const product of products) {
    if (!MARKETPLACE_SOURCES.has(product.source.trim().toLowerCase())) continue;
    const brand = product.brand.trim().toUpperCase();
    if (!brand.includes(needle) && !needle.includes(brand)) continue;
    if (product.source.trim().toLowerCase() === "farfetch") farfetch += 1;
    if (product.source.trim().toLowerCase() === "level-shoes") levelShoes += 1;
  }
  return { farfetch, levelShoes };
}
