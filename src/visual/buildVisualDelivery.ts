import type { ModelFamily } from "../modelFamily/types";
import { isVerifiedNew } from "../newArrivals/newness";
import { resolveModelFamilyProductUrl } from "../modelFamily/resolveProductUrl";
import { normalizeProductImageUrls } from "../images/resolveImageQuality";
import { slugifyBrandId } from "../source/sourceProductQuery";
import { colorVariantsForFamily } from "../modelFamily/colorVariants";
import {
  resolveVisualBasicCategory,
  VISUAL_BASIC_CATEGORIES,
  type VisualMappedCategoryId,
} from "./basicCategories";
import type { VisualCard, VisualShard, VisualSummary } from "./types";
import { MAX_VISUAL_CARD_IMAGES } from "../catalog/types";
import { isFashionMarketplaceFamily } from "../marketplaces/marketplacePolicy";

export interface VisualDeliveryInput {
  families: ModelFamily[];
  generatedAt?: string;
  brandIds?: Record<string, string>;
  marketplaceIds?: Record<string, string>;
}

export interface VisualDeliveryArtifacts {
  summary: VisualSummary;
  shards: VisualShard[];
}

function toCard(
  family: ModelFamily,
  basicCategory: VisualMappedCategoryId,
  locators?: { brandId?: string; marketplaceId?: string },
): VisualCard {
  const images = normalizeProductImageUrls([
    family.representativeImage,
    ...family.representativeImages,
    ...family.allImages,
  ]).slice(0, MAX_VISUAL_CARD_IMAGES);
  const sighting = family.sourceSightings?.[0];
  const newDates = (family.sourceSightings ?? [])
    .filter((item) => isVerifiedNew(item.newness))
    .map((item) => item.newness!.effectiveNewAt!);
  return {
    modelFamilyId: family.modelFamilyId,
    brand: family.brand,
    productName: family.canonicalName,
    mainImage: images[0] ?? family.representativeImage,
    images,
    sourceId: sighting?.sourceId ?? slugifyBrandId(family.brand),
    sourceUrl: resolveModelFamilyProductUrl(family),
    basicCategory,
    verifiedNew: newDates.length > 0,
    verifiedNewAt: newDates.length > 0
      ? newDates.reduce((latest, date) => Date.parse(date) > Date.parse(latest) ? date : latest)
      : null,
    brandId: locators?.brandId,
    marketplaceId: locators?.marketplaceId,
    variants: colorVariantsForFamily(family),
  };
}

export function buildVisualDelivery(input: VisualDeliveryInput): VisualDeliveryArtifacts {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const byCategory = new Map<VisualMappedCategoryId, VisualCard[]>();
  const all: VisualCard[] = [];
  const seen = new Set<string>();

  for (const family of input.families) {
    if (!isFashionMarketplaceFamily(family)) continue;
    if (seen.has(family.modelFamilyId)) continue;
    seen.add(family.modelFamilyId);
    const basicCategory = resolveVisualBasicCategory(family);
    const card = toCard(family, basicCategory, {
      brandId: input.brandIds?.[family.modelFamilyId],
      marketplaceId: input.marketplaceIds?.[family.modelFamilyId],
    });
    all.push(card);
    const list = byCategory.get(basicCategory) ?? [];
    list.push(card);
    byCategory.set(basicCategory, list);
  }

  const mappedShards = VISUAL_BASIC_CATEGORIES.filter(
    (item): item is { id: VisualMappedCategoryId; label: string } => item.id !== "tumu",
  ).map((item) => ({
    id: item.id,
    cards: byCategory.get(item.id) ?? [],
  }));

  const shards: VisualShard[] = [{ id: "tumu", cards: all }, ...mappedShards];

  const summary: VisualSummary = {
    generatedAt,
    totalCount: all.length,
    categories: VISUAL_BASIC_CATEGORIES.map((item) => ({
      id: item.id,
      label: item.label,
      count:
        item.id === "tumu"
          ? all.length
          : (byCategory.get(item.id as VisualMappedCategoryId) ?? []).length,
      verifiedNewCount: (item.id === "tumu" ? all : byCategory.get(item.id as VisualMappedCategoryId) ?? [])
        .filter((card) => card.verifiedNew).length,
    })),
  };

  return { summary, shards };
}

export function filterVisualCards(
  cards: VisualCard[],
  query: string,
  options: { onlyNew?: boolean } = {},
): VisualCard[] {
  const trimmed = query.trim().toLowerCase();
  const matching = cards.filter(
    (card) =>
      (!options.onlyNew || card.verifiedNew) &&
      (!trimmed || card.brand.toLowerCase().includes(trimmed) ||
      card.productName.toLowerCase().includes(trimmed)),
  );
  const timestamp = (card: VisualCard) => {
    const date = Date.parse(card.verifiedNewAt ?? "");
    return Number.isNaN(date) ? 0 : date;
  };
  return matching.sort((a, b) => Number(b.verifiedNew) - Number(a.verifiedNew) ||
    (a.verifiedNew && b.verifiedNew ? timestamp(b) - timestamp(a) : 0));
}
