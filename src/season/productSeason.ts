import type { ModelFamily } from "../modelFamily/types";
import { isVerifiedNew } from "../newArrivals/newness";

export type ProductSeason = "SS27" | "AW26_27" | "CARRY_OVER" | "UNKNOWN";
export type SeasonConfidence = "CONFIRMED" | "INFERRED";
export type ProductLifecycle = "NEW_ARRIVAL" | "CURRENT" | "SALE" | "ARCHIVE";

export interface ProductSeasonMeta {
  season: ProductSeason;
  confidence: SeasonConfidence;
  lifecycle: ProductLifecycle;
  evidence: string;
}

export const SEASON_OPTIONS: Array<{ value: ProductSeason | "ALL"; label: string }> = [
  { value: "ALL", label: "Tüm sezonlar" },
  { value: "SS27", label: "SS27 · Yaz 2027" },
  { value: "AW26_27", label: "AW26-27" },
  { value: "CARRY_OVER", label: "Carry Over" },
  { value: "UNKNOWN", label: "Belirsiz" },
];

export const SEASON_LABELS: Record<ProductSeason, string> = {
  SS27: "SS27 · Yaz 2027",
  AW26_27: "AW26-27",
  CARRY_OVER: "Carry Over",
  UNKNOWN: "Belirsiz",
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

const EXPLICIT_SS27 = [
  /\bss\s*[-/]?\s*27\b/i,
  /\bspring\s*[/&-]?\s*summer\s*2027\b/i,
  /\bspring\s*2027\b/i,
  /\bsummer\s*2027\b/i,
  /\byaz\s*2027\b/i,
  /\bilkbahar\s*[/&-]?\s*yaz\s*2027\b/i,
];

const EXPLICIT_AW26 = [
  /\baw\s*[-/]?\s*26(?:\s*[-/]\s*27)?\b/i,
  /\bfw\s*[-/]?\s*26(?:\s*[-/]\s*27)?\b/i,
  /\bautumn\s*[/&-]?\s*winter\s*2026(?:\s*[-/]\s*27)?\b/i,
  /\bfall\s*[/&-]?\s*winter\s*2026(?:\s*[-/]\s*27)?\b/i,
  /\bsonbahar\s*[/&-]?\s*kış\s*2026(?:\s*[-/]\s*27)?\b/i,
];

const SALE_SIGNAL = /\b(sale|outlet|indirim|reduced|last chance)\b/i;
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

export function deriveProductSeason(family: ModelFamily): ProductSeasonMeta {
  const text = evidenceText(family);
  const lifecycle = lifecycleForFamily(family, text);

  if (EXPLICIT_SS27.some((pattern) => pattern.test(text))) {
    return { season: "SS27", confidence: "CONFIRMED", lifecycle, evidence: "Kaynak sezon etiketi" };
  }
  if (EXPLICIT_AW26.some((pattern) => pattern.test(text))) {
    return { season: "AW26_27", confidence: "CONFIRMED", lifecycle, evidence: "Kaynak sezon etiketi" };
  }

  const category = family.primaryCategory ?? family.taxonomy?.primaryCategory ?? "UNCLASSIFIED";
  const seenAt = latestDate(family);
  const seen = seenAt ? Date.parse(seenAt) : Number.NaN;
  const launchWindowStart = Date.parse("2026-09-01T00:00:00.000Z");

  if (!Number.isNaN(seen) && seen >= launchWindowStart && lifecycle === "NEW_ARRIVAL") {
    if (SUMMER_CATEGORIES.has(category)) {
      return { season: "SS27", confidence: "INFERRED", lifecycle, evidence: "Yeni geliş tarihi + yaz kategorisi" };
    }
    if (WINTER_CATEGORIES.has(category)) {
      return { season: "AW26_27", confidence: "INFERRED", lifecycle, evidence: "Yeni geliş tarihi + kış kategorisi" };
    }
  }

  if (lifecycle === "CURRENT" && seenAt && Date.now() - seen > 180 * 24 * 60 * 60 * 1000) {
    return { season: "CARRY_OVER", confidence: "INFERRED", lifecycle, evidence: "Uzun süre güncel katalogda" };
  }

  return { season: "UNKNOWN", confidence: "INFERRED", lifecycle, evidence: "Yeterli sezon sinyali yok" };
}

export function filterFamiliesBySeason(
  families: ModelFamily[],
  season: ProductSeason | "ALL",
): ModelFamily[] {
  if (season === "ALL") return families;
  return families.filter((family) => deriveProductSeason(family).season === season);
}

