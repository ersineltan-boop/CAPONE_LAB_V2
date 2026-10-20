/** Keep exact brand values: the saved-products filter compares them verbatim. */
export function savedBrandOptions(
  registeredBrands: readonly string[],
  savedBrands: readonly string[],
): string[] {
  return [...new Set([...registeredBrands, ...savedBrands])]
    .filter((brand) => brand.trim().length > 0)
    .sort((a, b) => a.localeCompare(b, "tr"));
}
