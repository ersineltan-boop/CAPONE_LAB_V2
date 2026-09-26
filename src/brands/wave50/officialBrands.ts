import type { WaveBrandSeed } from "./types";
import { WAVE_BRAND_TARGET } from "./types";

export const NAKED_WOLFE_SEED: WaveBrandSeed = {
  slug: "naked-wolfe",
  brand: "NAKED WOLFE",
  officialUrl: "https://nakedwolfe.com",
  womenCollectionPath: "/collections/view-all-womens",
  newArrivalsPath: "/collections/new-arrivals",
  referenceFootwearTotal: 328,
  referenceNewArrivals: 126,
};

export interface UniverseBrandRef {
  id: string;
  brand: string;
  officialUrl?: string | null;
  collectorType?: string | null;
}

function normalizeOfficialUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    parsed.hash = "";
    parsed.search = "";
    return parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, ""));
  } catch {
    return null;
  }
}

/**
 * Deterministic scan list: Naked Wolfe, then official Shopify universe brands,
 * then the remaining official universe brands. Length is capped at 100.
 */
export function buildDeterministicWaveBrands(
  universe: readonly UniverseBrandRef[],
  target = WAVE_BRAND_TARGET,
): WaveBrandSeed[] {
  const seeds: WaveBrandSeed[] = [{ ...NAKED_WOLFE_SEED }];
  const seen = new Set<string>([NAKED_WOLFE_SEED.slug]);

  const usable = universe
    .map((entry) => {
      const officialUrl = entry.officialUrl ? normalizeOfficialUrl(entry.officialUrl) : null;
      return officialUrl ? { ...entry, officialUrl } : null;
    })
    .filter((entry): entry is UniverseBrandRef & { officialUrl: string } => entry !== null);

  const shopify = usable
    .filter((entry) => entry.collectorType === "SHOPIFY_PUBLIC")
    .sort((a, b) => a.id.localeCompare(b.id, "en"));
  const rest = usable
    .filter((entry) => entry.collectorType !== "SHOPIFY_PUBLIC")
    .sort((a, b) => a.id.localeCompare(b.id, "en"));

  for (const entry of [...shopify, ...rest]) {
    if (seeds.length >= target) break;
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    seeds.push({
      slug: entry.id,
      brand: entry.brand,
      officialUrl: entry.officialUrl,
    });
  }

  return seeds;
}
