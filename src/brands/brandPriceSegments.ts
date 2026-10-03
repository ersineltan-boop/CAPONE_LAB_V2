import entries from "./brandPriceSegments.json";

/** CAPONE research grouping; independent of the registry's trend influence segments. */
export type BrandPriceSegment = "LUXURY" | "PREMIUM" | "MID_RANGE" | "MASS_MARKET";
export type BrandPriceSegmentFilter = "all" | BrandPriceSegment;

export const BRAND_PRICE_SEGMENTS: readonly { id: BrandPriceSegment; label: string }[] = [
  { id: "LUXURY", label: "Lüks" },
  { id: "PREMIUM", label: "Premium" },
  { id: "MID_RANGE", label: "Orta segment" },
  { id: "MASS_MARKET", label: "Mass market" },
];

function brandKey(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const byId = new Map(entries.map((entry) => [entry.id, entry.segment as BrandPriceSegment]));
const byName = new Map(entries.map((entry) => [brandKey(entry.name), entry.segment as BrandPriceSegment]));

export function brandPriceSegment(brandId?: string, brandName?: string): BrandPriceSegment | null {
  return (brandId ? byId.get(brandId) : undefined) ??
    (brandName ? byName.get(brandKey(brandName)) : undefined) ?? null;
}

export function matchesBrandPriceSegment(
  filter: BrandPriceSegmentFilter,
  brandId?: string,
  brandName?: string,
): boolean {
  return filter === "all" || brandPriceSegment(brandId, brandName) === filter;
}

export function brandPriceSegmentLabel(brandId?: string, brandName?: string): string | null {
  const segment = brandPriceSegment(brandId, brandName);
  return BRAND_PRICE_SEGMENTS.find((option) => option.id === segment)?.label ?? null;
}
