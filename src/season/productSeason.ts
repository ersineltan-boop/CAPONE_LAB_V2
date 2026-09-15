import type { ModelFamily } from "../modelFamily/types";
import { isVerifiedNew } from "../newArrivals/newness";

export type ProductSeason = "SS27" | "AW26_27" | "CARRY_OVER";
export type SeasonConfidence = "CONFIRMED" | "INFERRED";
export type ProductLifecycle = "NEW_ARRIVAL" | "CURRENT" | "SALE" | "ARCHIVE";

export interface ProductSeasonMeta {
  season: ProductSeason;
  confidence: SeasonConfidence;
  confidenceScore: number;
  lifecycle: ProductLifecycle;
  evidence: string;
}

export const SEASON_OPTIONS: Array<{ value: ProductSeason | "ALL"; label: string }> = [
  { value: "ALL", label: "Tüm sezonlar" },
  { value: "SS27", label: "SS" },
  { value: "AW26_27", label: "FW" },
  { value: "CARRY_OVER", label: "COT" },
];

export const SEASON_LABELS: Record<ProductSeason, string> = {
  SS27: "SS",
  AW26_27: "FW",
  CARRY_OVER: "COT",
};

export const CONFIDENCE_LABELS: Record<SeasonConfidence, string> = {
  CONFIRMED: "Doğrulandı",
  INFERRED: "Tahmin",
};

export const LIFECYCLE_LABELS: Record<ProductLifecycle, string> = {
  NEW_ARRIVAL: "Yeni Gelen",
  CURRENT: "Güncel",
  SALE: "İndirim",
  ARCHIVE: "Arşiv",
};

const EXPLICIT_SS = [
  /\bss\s*[-/]?\s*\d{2}\b/i,
  /\bspring\s*[/&-]?\s*summer(?:\s*20\d{2})?\b/i,
  /\bspring(?:\s*20\d{2})?\b/i,
  /\bsummer(?:\s*20\d{2})?\b/i,
  /\byaz(?:\s*20\d{2})?\b/i,
  /\bilkbahar\s*[/&-]?\s*yaz(?:\s*20\d{2})?\b/i,
];

const EXPLICIT_FW = [
  /\b(?:aw|fw)\s*[-/]?\s*\d{2}(?:\s*[-/]\s*\d{2})?\b/i,
  /\bautumn\s*[/&-]?\s*winter(?:\s*20\d{2}(?:\s*[-/]\s*\d{2})?)?\b/i,
  /\bfall\s*[/&-]?\s*winter(?:\s*20\d{2}(?:\s*[-/]\s*\d{2})?)?\b/i,
  /\bsonbahar\s*[/&-]?\s*kış(?:\s*20\d{2}(?:\s*[-/]\s*\d{2})?)?\b/i,
];

const SALE_SIGNAL = /\b(sale|outlet|indirim|reduced|last chance)\b/i;
const SUMMER_TEXT_SIGNAL = /\b(sandal|sandals|slide|slides|espadrille|espadrilles|raffia|rafia|straw|jute|beach|summer|yaz)\b/i;
const WINTER_TEXT_SIGNAL = /\b(boot|boots|bootie|booties|ankle boot|knee boot|snow|shearling|winter|kış|çizme|bot)\b/i;
const SUMMER_CATEGORIES = new Set(["SANDAL", "MULE", "ESPADRILLE"]);
const WINTER_CATEGORIES = new Set(["BOOT"]);

function evidenceText(family: ModelFamily): string {
  return [
    family.canonicalName,
    ...(family.sourceCategoryRefs ?? []).flatMap((ref) => [
      ref.categoryName,
      ref.categoryPath,
      ref.categoryUrl,
    ]),
    ...(family.sourceSightings ?? []).flatMap((sighting) => [
      sighting.newness?.evidenceText,
      ...(sighting.sourceCategories ?? []).flatMap((category) => [
        category.categoryName,
        category.categoryPath,
        category.categoryUrl,
      ]),
    ]),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function latestDate(family: ModelFamily): string | null {
  const candidates = [
    family.modelFamilyFirstSeenAt,
    ...(family.sourceSightings ?? []).flatMap((sighting) => [
      sighting.newness?.effectiveNewAt,
      sighting.firstSeenAt,
    ]),
  ].filter((value): value is string => Boolean(value));
  return candidates.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

function lifecycleForFamily(family: ModelFamily, text: string): ProductLifecycle {
  if (SALE_SIGNAL.test(text)) return "SALE";
  if ((family.sourceSightings ?? []).some((sighting) => isVerifiedNew(sighting.newness))) {
    return "NEW_ARRIVAL";
  }

  const lastSeen = (family.sourceSightings ?? [])
    .map((sighting) => sighting.lastSeenAt)
    .filter(Boolean)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  if (lastSeen && Date.now() - Date.parse(lastSeen) > 120 * 24 * 60 * 60 * 1000) {
    return "ARCHIVE";
  }
  return "CURRENT";
}

function inferred(
  season: ProductSeason,
  lifecycle: ProductLifecycle,
  confidenceScore: number,
  evidence: string,
): ProductSeasonMeta {
  return { season, confidence: "INFERRED", confidenceScore, lifecycle, evidence };
}

export function deriveProductSeason(family: ModelFamily): ProductSeasonMeta {
  const text = evidenceText(family);
  const lifecycle = lifecycleForFamily(family, text);

  if (EXPLICIT_SS.some((pattern) => pattern.test(text))) {
    return { season: "SS27", confidence: "CONFIRMED", confidenceScore: 100, lifecycle, evidence: "Kaynak SS sezon etiketi" };
  }
  if (EXPLICIT_FW.some((pattern) => pattern.test(text))) {
    return { season: "AW26_27", confidence: "CONFIRMED", confidenceScore: 100, lifecycle, evidence: "Kaynak FW sezon etiketi" };
  }

  const category = family.primaryCategory ?? family.taxonomy?.primaryCategory ?? "UNCLASSIFIED";
  const seenAt = latestDate(family);
  const seen = seenAt ? Date.parse(seenAt) : Number.NaN;
  const ageDays = Number.isNaN(seen) ? null : (Date.now() - seen) / (24 * 60 * 60 * 1000);

  // A product that has remained in the live catalogue for a long time is a
  // stronger carry-over signal than its silhouette alone.
  if (lifecycle !== "NEW_ARRIVAL" && ageDays !== null && ageDays > 180) {
    return inferred("CARRY_OVER", lifecycle, 88, "180+ gündür katalogda · COT");
  }

  const summerCategory = SUMMER_CATEGORIES.has(category);
  const winterCategory = WINTER_CATEGORIES.has(category);
  const summerText = SUMMER_TEXT_SIGNAL.test(text);
  const winterText = WINTER_TEXT_SIGNAL.test(text);

  if ((summerCategory || summerText) && !(winterCategory || winterText)) {
    return inferred("SS27", lifecycle, summerCategory && summerText ? 92 : 84, "Ürün tipi/kategori · SS sinyali");
  }
  if ((winterCategory || winterText) && !(summerCategory || summerText)) {
    return inferred("AW26_27", lifecycle, winterCategory && winterText ? 92 : 84, "Ürün tipi/kategori · FW sinyali");
  }

  // For genuinely new trans-seasonal models (sneakers, loafers, ballet flats,
  // heels), first-seen month is useful supporting evidence. It is deliberately
  // lower confidence than a source season label or a seasonal silhouette.
  if (lifecycle === "NEW_ARRIVAL" && seenAt) {
    const month = new Date(seenAt).getUTCMonth() + 1;
    if (month >= 3 && month <= 8) {
      return inferred("SS27", lifecycle, 68, "Yeni geliş dönemi · SS");
    }
    return inferred("AW26_27", lifecycle, 68, "Yeni geliş dönemi · FW");
  }

  // Evergreen/trans-seasonal products without a strong SS/FW signal are COT.
  // This keeps the user-facing taxonomy exhaustive (SS/FW/COT) while the score
  // makes low-confidence decisions auditable in QA instead of exposing a large
  // 'Belirsiz' bucket.
  return inferred("CARRY_OVER", lifecycle, 55, "Sezonlar arası/evergreen ürün · düşük güvenli COT");
}

export function filterFamiliesBySeason(
  families: ModelFamily[],
  season: ProductSeason | "ALL",
): ModelFamily[] {
  if (season === "ALL") return families;
  return families.filter((family) => deriveProductSeason(family).season === season);
}
