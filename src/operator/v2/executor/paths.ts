export function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

export const FREE_PEOPLE_REFRESH_EXACT_PATHS = [
  "data/multibrand/products.json",
  "data/registry/marketplace-pilot.json",
  "data/multibrand/analyzed-products.json",
  "data/multibrand/market-analysis.json",
  "data/multibrand/model-family-report.json",
  "data/multibrand/taxonomy-qa-report.json",
  "data/multibrand/taxonomy-qa-samples.json",
] as const;

export const FREE_PEOPLE_REFRESH_PATH_PREFIXES = [
  "data/onboarding/staging/free-people/",
] as const;

export const FREE_PEOPLE_STAGING_PRODUCTS = "data/onboarding/staging/free-people/products.json";
export const FREE_PEOPLE_STAGING_REPORT = "data/onboarding/staging/free-people/report.json";
export const PRODUCTION_PRODUCTS = "data/multibrand/products.json";

const IGNORED_RUNTIME_PREFIXES = [
  "data/onboarding/staging/",
  "public/data/catalog/",
] as const;

export function isFreePeopleModelFamilyOutput(path: string): boolean {
  const normalized = normalizeRepoPath(path);
  if (normalized === "data/multibrand/model-families/manifest.json") return true;
  return /^data\/multibrand\/model-families\/part-\d{3}\.json$/.test(normalized);
}

export function isIgnoredRuntimePath(path: string): boolean {
  const normalized = normalizeRepoPath(path);
  if (normalized === "data/multibrand/model-families.json") return true;
  if (/(^|\/)products\.pre-[^/]+\.json$/.test(normalized)) return true;
  return IGNORED_RUNTIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function pathMatchesAllowlist(
  path: string,
  exact: readonly string[],
  prefixes: readonly string[],
): boolean {
  const normalized = normalizeRepoPath(path);
  if (exact.includes(normalized)) return true;
  if (isFreePeopleModelFamilyOutput(normalized)) return true;
  return prefixes.some((prefix) => normalized.startsWith(normalizeRepoPath(prefix)));
}

export function unexpectedChangedPaths(
  paths: readonly string[],
  exact: readonly string[],
  prefixes: readonly string[],
): string[] {
  return paths.filter((path) => !isIgnoredRuntimePath(path) && !pathMatchesAllowlist(path, exact, prefixes));
}
