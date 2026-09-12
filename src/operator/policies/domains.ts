import { browsableMarketplaces, loadMarketplaceRegistry } from "../../registry/data/marketplaces";
import { loadBrandRegistry } from "../../registry/data";
import { PRIMARY_NAV_ITEMS } from "../../navigation/primaryNav";
import type {
  DomainRecord,
  SourceOccurrence,
  TaskDomain,
  UserFacingRegistry,
} from "../types";
import { MARKET_RESEARCH_REGISTRIES, PRODUCT_RESEARCH_REGISTRIES } from "../types";

export class DomainIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainIsolationError";
  }
}

export function isProductResearchRegistry(registry: UserFacingRegistry): boolean {
  return (PRODUCT_RESEARCH_REGISTRIES as readonly string[]).includes(registry);
}

export function isMarketResearchRegistry(registry: UserFacingRegistry): boolean {
  return (MARKET_RESEARCH_REGISTRIES as readonly string[]).includes(registry);
}

export function registriesShareUserFacingSurface(
  left: UserFacingRegistry,
  right: UserFacingRegistry,
): boolean {
  if (left === right) return true;
  return isProductResearchRegistry(left) === isProductResearchRegistry(right);
}

export function assertRegistriesIsolated(
  left: UserFacingRegistry,
  right: UserFacingRegistry,
): void {
  const leftDomain = isProductResearchRegistry(left) ? "PRODUCT_RESEARCH" : "MARKET_RESEARCH";
  const rightDomain = isProductResearchRegistry(right) ? "PRODUCT_RESEARCH" : "MARKET_RESEARCH";
  if (leftDomain !== rightDomain) {
    throw new DomainIsolationError(
      `Cannot share a user-facing registry across domains: ${left} (${leftDomain}) vs ${right} (${rightDomain})`,
    );
  }
}

export function canPlaceRecordOnRegistry(record: DomainRecord, registry: UserFacingRegistry): boolean {
  if (record.domain === "PRODUCT_RESEARCH") {
    return isProductResearchRegistry(registry);
  }
  if (record.domain === "MARKET_RESEARCH") {
    return isMarketResearchRegistry(registry);
  }
  return false;
}

export function assertNoMarketResearchLeak(
  productResearchIds: readonly string[],
  marketResearchRecords: readonly DomainRecord[],
): void {
  const productIds = new Set(productResearchIds);
  for (const record of marketResearchRecords) {
    if (record.domain !== "MARKET_RESEARCH") continue;
    if (productIds.has(record.id)) {
      throw new DomainIsolationError(
        `Market Research record "${record.id}" leaked into Product Research registry`,
      );
    }
    if (isProductResearchRegistry(record.registry)) {
      throw new DomainIsolationError(
        `Market Research record "${record.id}" cannot live on ${record.registry}`,
      );
    }
  }
}

export function sameBrandMayExistInBothDomains(
  productResearch: DomainRecord,
  marketResearch: DomainRecord,
): boolean {
  if (productResearch.domain !== "PRODUCT_RESEARCH") return false;
  if (marketResearch.domain !== "MARKET_RESEARCH") return false;
  if (productResearch.id === marketResearch.id) return false;
  return productResearch.name.trim().toLowerCase() === marketResearch.name.trim().toLowerCase();
}

export function originCountryIsNotSalesMarket(
  originCountry: string | null | undefined,
  markets: readonly string[],
): boolean {
  if (!originCountry?.trim()) return true;
  const origin = originCountry.trim().toLowerCase();
  return !markets.some((market) => market.trim().toLowerCase() === origin);
}

export function retainDualSourceOccurrences(
  occurrences: readonly SourceOccurrence[],
): SourceOccurrence[] {
  return occurrences.filter((item) => item.sourceUrl.trim().length > 0);
}

export function visualCanonicalKey(productKey: string): string {
  return `visual:${productKey.trim().toLowerCase()}`;
}

export function visualMayDeduplicateAcrossSources(
  occurrences: readonly SourceOccurrence[],
): { canonicalKey: string; sourceCount: number; sourcesPreserved: SourceOccurrence[] } {
  const kept = retainDualSourceOccurrences(occurrences);
  if (kept.length === 0) {
    return { canonicalKey: visualCanonicalKey(""), sourceCount: 0, sourcesPreserved: [] };
  }
  return {
    canonicalKey: visualCanonicalKey(kept[0]!.productKey),
    sourceCount: kept.length,
    sourcesPreserved: kept,
  };
}

export function markalarAndPazaryerleriAreSeparateRegistries(): boolean {
  return PRODUCT_RESEARCH_REGISTRIES.includes("MARKALAR") &&
    PRODUCT_RESEARCH_REGISTRIES.includes("PAZARYERLERI") &&
    PRIMARY_NAV_ITEMS.some((item) => item.id === "brands") &&
    PRIMARY_NAV_ITEMS.some((item) => item.id === "marketplaces");
}

export function liveProductResearchBrandIds(): string[] {
  return loadBrandRegistry().all().map((entry) => entry.id);
}

export function liveProductResearchMarketplaceIds(): string[] {
  return loadMarketplaceRegistry().map((entry) => entry.id);
}

export function liveBrowsableMarketplaceIds(): string[] {
  return browsableMarketplaces().map((entry) => entry.id);
}

export function marketResearchMustNotUseVisualPipeline(domain: TaskDomain): boolean {
  return domain !== "PRODUCT_RESEARCH";
}
