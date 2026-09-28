export const EXPANSION_REFRESH_IDS = [
  'nine-west', 'loeffler-randall', 'freda-salvador', 'sarah-flint',
  'tkees', 'brother-vellies', 'nodaleto',
] as const;

// A preserved catalog cannot prove that this run collected fresh products.
export function expansionRefreshDecision(previous: any, candidate: any): string | null {
  if (!candidate || candidate.generatedAt === previous?.generatedAt) return 'No fresh snapshot';
  const coverage = candidate.coverage;
  if (!coverage?.paginationExhausted) return 'Pagination incomplete';
  if (!Array.isArray(coverage.errors) || coverage.errors.length) return 'Collector errors';
  if (!Number.isInteger(coverage.freshProducts) || coverage.freshProducts <= 0) return 'No verified fresh products';
  const priorCount = previous?.products?.length ?? 0;
  if (coverage.freshProducts < priorCount * 0.8) return 'Fresh catalog dropped more than 20%';
  if (!Array.isArray(candidate.products) || candidate.products.length < priorCount) return 'Last-good products lost';
  const urls = new Set(candidate.products.map((p: any) => p.productUrl));
  if (previous?.products?.some((p: any) => !urls.has(p.productUrl))) return 'Last-good product URL lost';
  return null;
}
