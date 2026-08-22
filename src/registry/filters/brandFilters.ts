import type { BrandRegistryEntry, BrandRole, BrandSegment, TrackingPriority } from "../types/brand";

export interface BrandFilterCriteria {
  country?: string;
  segment?: BrandSegment;
  role?: BrandRole;
  trackingPriority?: TrackingPriority;
  isActive?: boolean;
}

export function filterBrands(
  entries: readonly BrandRegistryEntry[],
  criteria: BrandFilterCriteria,
): BrandRegistryEntry[] {
  return entries.filter((entry) => {
    if (criteria.country !== undefined && entry.country !== criteria.country) {
      return false;
    }
    if (criteria.segment !== undefined && entry.segment !== criteria.segment) {
      return false;
    }
    if (criteria.role !== undefined && entry.role !== criteria.role) {
      return false;
    }
    if (
      criteria.trackingPriority !== undefined &&
      entry.trackingPriority !== criteria.trackingPriority
    ) {
      return false;
    }
    if (criteria.isActive !== undefined && entry.isActive !== criteria.isActive) {
      return false;
    }
    return true;
  });
}

export function filterBrandsByPriority(
  entries: readonly BrandRegistryEntry[],
  priority: TrackingPriority,
): BrandRegistryEntry[] {
  return filterBrands(entries, { trackingPriority: priority, isActive: true });
}

export function filterBrandsP1(
  entries: readonly BrandRegistryEntry[],
): BrandRegistryEntry[] {
  return filterBrandsByPriority(entries, "P1");
}

export function filterBrandsP2(
  entries: readonly BrandRegistryEntry[],
): BrandRegistryEntry[] {
  return filterBrandsByPriority(entries, "P2");
}

export function filterBrandsP3(
  entries: readonly BrandRegistryEntry[],
): BrandRegistryEntry[] {
  return filterBrandsByPriority(entries, "P3");
}

export function filterBrandsByCountry(
  entries: readonly BrandRegistryEntry[],
  country: string,
): BrandRegistryEntry[] {
  return filterBrands(entries, { country });
}

export function filterBrandsBySegment(
  entries: readonly BrandRegistryEntry[],
  segment: BrandSegment,
): BrandRegistryEntry[] {
  return filterBrands(entries, { segment });
}

export function filterBrandsByRole(
  entries: readonly BrandRegistryEntry[],
  role: BrandRole,
): BrandRegistryEntry[] {
  return filterBrands(entries, { role });
}

export function sortBrandsByFootwearInfluence(
  entries: readonly BrandRegistryEntry[],
  direction: "desc" | "asc" = "desc",
): BrandRegistryEntry[] {
  return [...entries].sort((a, b) =>
    direction === "desc"
      ? b.footwearInfluence - a.footwearInfluence
      : a.footwearInfluence - b.footwearInfluence,
  );
}
