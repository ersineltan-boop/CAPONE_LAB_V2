import { VISION_VERIFICATION_THRESHOLDS } from "./config";
import type { ModelFamily } from "../../modelFamily/types";
import type { AnalyzedProduct } from "../../types/marketAnalysis";
import type { PilotFamilyCandidate } from "./types";

const WAVE1_BRANDS = new Set([
  "CHRISTEN",
  "NEOUS",
  "STUDIO AMELIA",
  "AEYDE",
  "HEREU",
  "SOULIERS MARTINEZ",
  "LUIS ONOFRE",
  "FLATTERED",
  "MARAY",
  "EXÉ",
]);

const TARGET_CONSTRUCTIONS = [
  "ANKLE_STRAP",
  "SLINGBACK",
  "BACKLESS",
  "T_STRAP",
  "OPEN_TOE",
  "CLOSED_TOE",
  "LOW_VAMP",
  "HIGH_VAMP",
] as const;

const TARGET_DETAILS = ["THONG", "LACE_UP", "BOW", "BUCKLE"] as const;

const TARGET_CATEGORIES = [
  "PUMP",
  "SANDAL",
  "BALLERINA",
  "MULE",
  "WEDGE",
  "SNEAKER",
  "BOOT",
  "LOAFER",
] as const;

const CONFUSION_KEYWORDS =
  /thong|slingback|sling back|mary.?jane|ankle.?strap|backless|flip.?flop|mule|instep/i;

function scoreFamily(
  family: ModelFamily,
  product: AnalyzedProduct | undefined,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const imageCount = family.representativeImages.length;
  if (imageCount >= 4) {
    score += 12;
    reasons.push(`${imageCount} rep images`);
  } else if (imageCount >= 2) {
    score += 6;
    reasons.push(`${imageCount} rep images`);
  }

  if (WAVE1_BRANDS.has(family.brand)) {
    score += 8;
    reasons.push("Wave 1 brand");
  }

  if (product) {
    for (const tag of TARGET_CONSTRUCTIONS) {
      if (product.normalized.construction.includes(tag)) {
        score += 10;
        reasons.push(`construction:${tag}`);
      }
    }
    for (const tag of TARGET_DETAILS) {
      if (product.normalized.details.includes(tag)) {
        score += 8;
        reasons.push(`detail:${tag}`);
      }
    }
    const category = product.normalized.category ?? product.category;
    if (category && TARGET_CATEGORIES.includes(category as (typeof TARGET_CATEGORIES)[number])) {
      score += 4;
      reasons.push(`category:${category}`);
    }
    if (CONFUSION_KEYWORDS.test(product.productName)) {
      score += 15;
      reasons.push("strap confusion risk");
    }
    if (
      product.normalized.construction.includes("ANKLE_STRAP") &&
      (product.normalized.details.includes("THONG") ||
        product.normalized.construction.includes("SLINGBACK") ||
        product.normalized.construction.includes("BACKLESS"))
    ) {
      score += 20;
      reasons.push("ankle strap + conflicting silhouette");
    }
  }

  if (family.variantCount > 1) {
    score += 3;
    reasons.push(`${family.variantCount} color variants`);
  }

  return { score, reasons };
}

export function selectVerificationPilotFamilies(input: {
  families: ModelFamily[];
  products: AnalyzedProduct[];
  limit?: number;
}): PilotFamilyCandidate[] {
  const { maxFamiliesPerBrand, pilotFamilyCount } = VISION_VERIFICATION_THRESHOLDS;
  const limit = input.limit ?? pilotFamilyCount;
  const productByUrl = new Map(
    input.products.map((product) => [product.productUrl, product]),
  );

  const scored = input.families
    .filter((family) => family.representativeImages.length >= 1)
    .map((family) => {
      const product = productByUrl.get(family.representativeProductId);
      const { score, reasons } = scoreFamily(family, product);
      return {
        modelFamilyId: family.modelFamilyId,
        brand: family.brand,
        canonicalName: family.canonicalName,
        category: family.category,
        representativeProductId: family.representativeProductId,
        representativeImages: family.representativeImages.slice(
          0,
          VISION_VERIFICATION_THRESHOLDS.maxEvidenceImages,
        ),
        selectionScore: score,
        selectionReasons: reasons,
      };
    })
    .sort((a, b) => b.selectionScore - a.selectionScore);

  const selected: PilotFamilyCandidate[] = [];
  const brandCounts = new Map<string, number>();
  const usedCategories = new Set<string>();

  for (const candidate of scored) {
    if (selected.length >= limit) break;
    const brandCount = brandCounts.get(candidate.brand) ?? 0;
    if (brandCount >= maxFamiliesPerBrand) continue;

    selected.push(candidate);
    brandCounts.set(candidate.brand, brandCount + 1);
    if (candidate.category) usedCategories.add(candidate.category);
  }

  if (selected.length < limit) {
    for (const candidate of scored) {
      if (selected.length >= limit) break;
      if (selected.some((item) => item.modelFamilyId === candidate.modelFamilyId)) {
        continue;
      }
      const brandCount = brandCounts.get(candidate.brand) ?? 0;
      if (brandCount >= maxFamiliesPerBrand + 1) continue;
      selected.push(candidate);
      brandCounts.set(candidate.brand, brandCount + 1);
    }
  }

  return selected.slice(0, limit);
}
