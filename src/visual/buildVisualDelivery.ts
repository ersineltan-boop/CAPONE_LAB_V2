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
  return {
    modelFamilyId: family.modelFamilyId,
    brand: family.brand,
    productName: family.canonicalName,
    mainImage: images[0] ?? family.representativeImage,
    images,
    sourceId: sighting?.sourceId ?? slugifyBrandId(family.brand),
    sourceUrl: resolveModelFamilyProductUrl(family),
    basicCategory,
    verifiedNew: Boolean(
      family.sourceSightings?.some((item) => isVerifiedNew(item.newness)),
    ),
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
    })),
  };

  return { summary, shards };
}

export function filterVisualCards(
  cards: VisualCard[],
  query: string,
): VisualCard[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return cards;
  return cards.filter(
    (card) =>
      card.brand.toLowerCase().includes(trimmed) ||
      card.productName.toLowerCase().includes(trimmed),
  );
}
