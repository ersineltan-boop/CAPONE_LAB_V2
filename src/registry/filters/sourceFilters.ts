import type {
  SourceLayer,
  SourceRegistryRole,
  TrendSourceRegistryEntry,
} from "../types/source";
import { isProductionRegistrySource, isTrendMarketRegistrySource } from "../types/source";

export interface SourceFilterCriteria {
  country?: string;
  layer?: SourceLayer;
  role?: SourceRegistryRole;
  isActive?: boolean;
}

export function filterSources(
  entries: readonly TrendSourceRegistryEntry[],
  criteria: SourceFilterCriteria,
): TrendSourceRegistryEntry[] {
  return entries.filter((entry) => {
    if (criteria.country !== undefined && entry.country !== criteria.country) {
      return false;
    }
    if (criteria.layer !== undefined && entry.layer !== criteria.layer) {
      return false;
    }
    if (criteria.role !== undefined && entry.role !== criteria.role) {
      return false;
    }
    if (criteria.isActive !== undefined && entry.isActive !== criteria.isActive) {
      return false;
    }
    return true;
  });
}

export function filterTrendMarketSources(
  entries: readonly TrendSourceRegistryEntry[],
): TrendSourceRegistryEntry[] {
  return entries.filter(isTrendMarketRegistrySource);
}

export function filterProductionSources(
  entries: readonly TrendSourceRegistryEntry[],
): TrendSourceRegistryEntry[] {
  return entries.filter(isProductionRegistrySource);
}

export function filterSourcesByCountry(
  entries: readonly TrendSourceRegistryEntry[],
  country: string,
): TrendSourceRegistryEntry[] {
  return filterSources(entries, { country });
}

export function filterSourcesByLayer(
  entries: readonly TrendSourceRegistryEntry[],
  layer: SourceLayer,
): TrendSourceRegistryEntry[] {
  return filterSources(entries, { layer });
}

export function filterSourcesByRole(
  entries: readonly TrendSourceRegistryEntry[],
  role: SourceRegistryRole,
): TrendSourceRegistryEntry[] {
  return filterSources(entries, { role });
}

export function filterActiveSources(
  entries: readonly TrendSourceRegistryEntry[],
): TrendSourceRegistryEntry[] {
  return filterSources(entries, { isActive: true });
}
