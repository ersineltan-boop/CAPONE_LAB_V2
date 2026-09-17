import type { ModelFamily } from "../modelFamily/types";
import type { RawAnalyzedProduct } from "../modelFamily/types";
import type { SourceSighting } from "../taxonomy/types";
import {
  MARKETPLACE_SOURCE_IDS,
  normalizeMarketplaceSourceId,
} from "../marketplaces/marketplacePolicy";
import { createNotVerifiedNewness } from "./newness";
import {
  buildNewnessFromProductHints,
  detectNewBadgeInText,
  isNewArrivalsCollectionPath,
  mergeSourceNewness,
} from "./detectNewness";
import {
  buildSourceCategoryRefs,
  allCategoriesFromProduct,
  mergeSourceCategories,
} from "../source/sourceCategories";

function slugifySourceId(value: string): string {
  return normalizeMarketplaceSourceId(value);
}

function earliestDate(dates: string[]): string {
  return dates.reduce((min, date) =>
    Date.parse(date) < Date.parse(min) ? date : min,
  );
}

function latestDate(dates: string[]): string {
  return dates.reduce((max, date) =>
    Date.parse(date) > Date.parse(max) ? date : max,
  );
}

function buildNewnessFromProduct(
  product: RawAnalyzedProduct,
  verifiedAt: string,
) {
  const collectionPath = product.collectionPath ?? product.sourceCategoryPath ?? null;
  return buildNewnessFromProductHints(
    {
      collectionPath,
      collectionLabel: product.collectionLabel ?? product.sourceCategoryName ?? collectionPath,
      isNewArrivalsCollection:
        product.isNewArrivalsCollection ??
        isNewArrivalsCollectionPath(collectionPath),
      hasNewBadge:
        product.hasNewBadge ??
        detectNewBadgeInText(product.productName),
      publishedAt: product.publishedAt ?? null,
      createdAt: product.createdAt ?? null,
      productUrl: product.productUrl,
    },
    verifiedAt,
  );
}

function pickStrongestNewness(
  products: RawAnalyzedProduct[],
  verifiedAt: string,
) {
  if (products.length === 0) return createNotVerifiedNewness();
  return products
    .map((product) => buildNewnessFromProduct(product, verifiedAt))
    .reduce((best, current) => {
      if (current.status === "VERIFIED_NEW" && best.status !== "VERIFIED_NEW") {
        return current;
      }
      return best;
    }, createNotVerifiedNewness());
}

function aggregateSourceCategories(products: RawAnalyzedProduct[]) {
  return products.reduce((categories, product) => {
    return allCategoriesFromProduct(product).reduce(
      (acc, category) => mergeSourceCategories(acc, category),
      categories,
    );
  }, [] as NonNullable<SourceSighting["sourceCategories"]>);
}

export function computeModelFamilyFirstSeenAt(
  products: RawAnalyzedProduct[],
): string | null {
  const dates = products
    .map((product) => product.discoveredAt)
    .filter(Boolean);
  if (dates.length === 0) return null;
  return earliestDate(dates);
}

export function buildBrandSourceSighting(
  brand: string,
  products: RawAnalyzedProduct[],
  existing?: SourceSighting | null,
): SourceSighting {
  const discoveredDates = products.map((product) => product.discoveredAt).filter(Boolean);
  const crawlFirst = discoveredDates.length > 0 ? earliestDate(discoveredDates) : new Date().toISOString();
  const crawlLast = discoveredDates.length > 0 ? latestDate(discoveredDates) : crawlFirst;
  const strongestNewness = pickStrongestNewness(products, crawlLast);
  const sourceCategories = aggregateSourceCategories(products);

  if (!existing) {
    return {
      sourceId: slugifySourceId(brand),
      sourceLabel: brand,
      sourceKind: "BRAND_OFFICIAL",
      firstSeenAt: crawlFirst,
      lastSeenAt: crawlLast,
      newness: strongestNewness,
      sourceCategories,
    };
  }

  const mergedCategories = sourceCategories.reduce(
    (acc, category) => mergeSourceCategories(acc, category),
    [...(existing.sourceCategories ?? [])],
  );

  return {
    ...existing,
    sourceKind: "BRAND_OFFICIAL",
    lastSeenAt: crawlLast,
    firstSeenAt: earliestDate([existing.firstSeenAt, crawlFirst]),
    newness: mergeSourceNewness(existing.newness, strongestNewness, crawlLast),
    sourceCategories: mergedCategories,
  };
}

export function buildMarketplaceSourceSighting(
  sourceId: string,
  sourceLabel: string,
  products: RawAnalyzedProduct[],
  existing?: SourceSighting | null,
): SourceSighting {
  sourceId = normalizeMarketplaceSourceId(sourceId);
  const discoveredDates = products.map((product) => product.discoveredAt).filter(Boolean);
  const crawlFirst = discoveredDates.length > 0 ? earliestDate(discoveredDates) : new Date().toISOString();
  const crawlLast = discoveredDates.length > 0 ? latestDate(discoveredDates) : crawlFirst;
  const strongestNewness = pickStrongestNewness(products, crawlLast);
  const sourceCategories = aggregateSourceCategories(products);

  if (!existing) {
    return {
      sourceId,
      sourceLabel,
      sourceKind: "LUXURY_MARKETPLACE",
      firstSeenAt: crawlFirst,
      lastSeenAt: crawlLast,
      newness: strongestNewness,
      sourceCategories,
    };
  }

  const mergedCategories = sourceCategories.reduce(
    (acc, category) => mergeSourceCategories(acc, category),
    [...(existing.sourceCategories ?? [])],
  );

  return {
    ...existing,
    sourceKind: "LUXURY_MARKETPLACE",
    lastSeenAt: crawlLast,
    firstSeenAt: earliestDate([existing.firstSeenAt, crawlFirst]),
    newness: mergeSourceNewness(existing.newness, strongestNewness, crawlLast),
    sourceCategories: mergedCategories,
  };
}

export function mergeSourceSightings(
  existing: SourceSighting[] | undefined,
  incoming: SourceSighting,
): SourceSighting[] {
  const list = existing ? [...existing] : [];
  const incomingSourceId = normalizeMarketplaceSourceId(incoming.sourceId);
  const index = list.findIndex(
    (item) => normalizeMarketplaceSourceId(item.sourceId) === incomingSourceId,
  );
  incoming = { ...incoming, sourceId: incomingSourceId };
  if (index === -1) {
    list.push(incoming);
    return list;
  }

  const prior = list[index]!;
  const mergedCategories = (incoming.sourceCategories ?? []).reduce(
    (acc, category) => mergeSourceCategories(acc, category),
    [...(prior.sourceCategories ?? [])],
  );

  list[index] = {
    ...prior,
    ...incoming,
    firstSeenAt: earliestDate([prior.firstSeenAt, incoming.firstSeenAt]),
    lastSeenAt: latestDate([prior.lastSeenAt, incoming.lastSeenAt]),
    newness: incoming.newness
      ? mergeSourceNewness(prior.newness, incoming.newness, incoming.lastSeenAt)
      : prior.newness,
    sourceCategories: mergedCategories,
  };
  return list;
}

function isMarketplaceSource(sourceId: string): boolean {
  return MARKETPLACE_SOURCE_IDS.has(normalizeMarketplaceSourceId(sourceId));
}

export function enrichFamilyWithSightings(
  family: ModelFamily,
  products: RawAnalyzedProduct[],
  priorFamily?: ModelFamily | null,
): Pick<ModelFamily, "modelFamilyFirstSeenAt" | "sourceSightings" | "sourceCategoryRefs"> {
  const firstSeenAt =
    priorFamily?.modelFamilyFirstSeenAt ??
    computeModelFamilyFirstSeenAt(products) ??
    undefined;

  const brandProducts = products.filter(
    (product) => !isMarketplaceSource(product.source) && product.source !== "mytheresa",
  );
  const marketplaceGroups = new Map<string, RawAnalyzedProduct[]>();
  for (const product of products) {
    if (!isMarketplaceSource(product.source)) continue;
    const sourceId = normalizeMarketplaceSourceId(product.source);
    const list = marketplaceGroups.get(sourceId) ?? [];
    list.push(product);
    marketplaceGroups.set(sourceId, list);
  }

  let sourceSightings: SourceSighting[] = [];

  if (brandProducts.length > 0) {
    const brandSighting = buildBrandSourceSighting(
      family.brand,
      brandProducts,
      priorFamily?.sourceSightings?.find((s) => s.sourceId === slugifySourceId(family.brand)),
    );
    sourceSightings = mergeSourceSightings(sourceSightings, brandSighting);
  }

  for (const [marketplaceId, marketplaceProducts] of marketplaceGroups) {
    const label =
      marketplaceId === "mytheresa"
        ? "Mytheresa"
        : marketplaceId === "level-shoes"
          ? "Level Shoes"
          : marketplaceId === "free-people"
            ? "Free People"
          : marketplaceId.replace(/-/g, " ");
    const marketplaceSighting = buildMarketplaceSourceSighting(
      marketplaceId,
      label,
      marketplaceProducts,
      priorFamily?.sourceSightings?.find(
        (s) => normalizeMarketplaceSourceId(s.sourceId) === marketplaceId,
      ),
    );
    sourceSightings = mergeSourceSightings(sourceSightings, marketplaceSighting);
  }

  const sourceCategoryRefs = [
    ...buildSourceCategoryRefs(slugifySourceId(family.brand), brandProducts),
    ...[...marketplaceGroups.entries()].flatMap(([sourceId, groupProducts]) =>
      buildSourceCategoryRefs(sourceId, groupProducts),
    ),
  ];

  return {
    modelFamilyFirstSeenAt: firstSeenAt,
    sourceSightings,
    sourceCategoryRefs,
  };
}
