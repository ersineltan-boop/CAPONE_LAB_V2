import { fetchText } from "./http";

const FOOTWEAR_PATH_HINT =
  /shoe|footwear|heel|sandal|boot|flat|pump|mule|loafer|sneaker|shop-all|all-styles|new-arrival|women|womens/i;

const COLLECTION_HREF =
  /href=["']([^"']*(?:\/collections\/[^"'#?]+|\/en(?:-[a-z]{2})?\/collections\/[^"'#?]+))["']/gi;

function normalizePath(href: string, baseUrl: string): string | null {
  try {
    const absolute = href.startsWith("http")
      ? new URL(href)
      : new URL(href, baseUrl);
    if (absolute.origin !== new URL(baseUrl).origin) return null;
    return absolute.pathname.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export async function discoverCollectionPaths(baseUrl: string): Promise<string[]> {
  const result = await fetchText(baseUrl.replace(/\/$/, ""), { delayMs: 1200 });
  if (!result.ok) return [];

  const paths = new Set<string>();
  for (const match of result.text.matchAll(COLLECTION_HREF)) {
    const path = normalizePath(match[1] ?? "", baseUrl);
    if (!path || !FOOTWEAR_PATH_HINT.test(path)) continue;
    paths.add(path);
  }

  if (paths.size === 0) {
    for (const fallback of [
      "/collections/shoes",
      "/collections/footwear",
      "/collections/all-shoes",
      "/collections/womens-shoes",
      "/collections/shop-all",
      "/collections/all",
      "/en/collections/shoes",
    ]) {
      paths.add(fallback);
    }
  }

  return [...paths].slice(0, 6);
}

export async function resolveCollectionPaths(
  config: { baseUrl: string; collectionPaths: string[] },
): Promise<string[]> {
  if (config.collectionPaths.length > 0) return config.collectionPaths;
  return discoverCollectionPaths(config.baseUrl);
}
