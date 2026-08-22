import type { ModelFamily } from "../modelFamily/types";
import { getFamilyPrimaryCategory } from "../categories/taxonomyFilters";
import type { PrimaryFootwearCategory } from "../taxonomy/types";
import type { SourceNativeCategory } from "../source/types";

export const VISUAL_BASIC_CATEGORY_IDS = [
  "tumu",
  "babet",
  "loafer",
  "topuklu",
  "sandal",
  "mule",
  "bot-cizme",
  "sneaker",
  "espadril",
  "oxford-derby",
  "clog",
  "diger",
] as const;

export type VisualBasicCategoryId = (typeof VISUAL_BASIC_CATEGORY_IDS)[number];

export type VisualMappedCategoryId = Exclude<VisualBasicCategoryId, "tumu">;

export interface VisualBasicCategoryOption {
  id: VisualBasicCategoryId;
  label: string;
}

export const VISUAL_BASIC_CATEGORIES: readonly VisualBasicCategoryOption[] = [
  { id: "tumu", label: "TÜMÜ" },
  { id: "babet", label: "BABET" },
  { id: "loafer", label: "LOAFER" },
  { id: "topuklu", label: "TOPUKLU" },
  { id: "sandal", label: "SANDAL" },
  { id: "mule", label: "MULE" },
  { id: "bot-cizme", label: "BOT / ÇİZME" },
  { id: "sneaker", label: "SNEAKER" },
  { id: "espadril", label: "ESPADRİL" },
  { id: "oxford-derby", label: "OXFORD / DERBY" },
  { id: "clog", label: "CLOG" },
  { id: "diger", label: "DİĞER" },
];

/** Shared Brand + Visual labels. */
export const BASIC_FOOTWEAR_CATEGORIES = VISUAL_BASIC_CATEGORIES;

const GENERIC_SOURCE_CATEGORY =
  /^(all|shop all|view all|shoes|footwear|women'?s shoes|womens shoes|women shoes|new arrivals|new in|ready to wear|shoes view all|shop all shoes|shoes new in|womens new in shoes|all footwear|all shoes)$/i;

const WEAK_COMMERCIAL_NAME =
  /^(heels?|platforms?|flats?|shop all heels?|all heels?|women'?s? heels?|womens? heels?)$/i;

interface SourceMapRule {
  id: VisualMappedCategoryId;
  pattern: RegExp;
}

const SOURCE_MAP_RULES: readonly SourceMapRule[] = [
  {
    id: "babet",
    pattern:
      /\bballet flats?\b|\bballerinas?\b|\bballets?\b|\bmary[- ]janes?\b|\bclosed[- ]toe flats?\b/i,
  },
  { id: "loafer", pattern: /\bloafers?\b/i },
  { id: "mule", pattern: /\bmules?\b/i },
  { id: "sandal", pattern: /\bsandals?\b|\bsand[aá]lias?\b/i },
  { id: "sneaker", pattern: /\bsneakers?\b|\btrainers?\b/i },
  { id: "espadril", pattern: /\bespadrilles?\b/i },
  { id: "oxford-derby", pattern: /\boxfords?\b|\bderbys?\b|\bbrogues?\b/i },
  { id: "clog", pattern: /\bclogs?\b/i },
  {
    id: "bot-cizme",
    pattern:
      /\bover[- ]the[- ]knee boots?\b|\bknee(?:[- ]high)? boots?\b|\bankle boots?\b|\bbooties?\b|\bchelsea boots?\b|\bwellingtons?\b|\brain boots?\b|\bwestern boots?\b|\bslouch boots?\b|\bstiletto boots?\b|\bwide[- ]shaft boots?\b|\bplatform boots?\b|\bmenu boots?\b|\bboots?\b/i,
  },
  {
    id: "topuklu",
    pattern: /\bcourt shoes?\b|\bpumps?\b|\bkitten heels?\b|\bblock heels?\b|\bheels?\b/i,
  },
];

const STRUCTURAL_TYPES: readonly VisualMappedCategoryId[] = [
  "mule",
  "sandal",
  "loafer",
  "babet",
  "sneaker",
  "espadril",
  "oxford-derby",
  "clog",
  "bot-cizme",
];

const PRIMARY_TO_VISUAL: Record<PrimaryFootwearCategory, VisualMappedCategoryId> = {
  BALLET_FLAT: "babet",
  LOAFER: "loafer",
  PUMP: "topuklu",
  SANDAL: "sandal",
  MULE: "mule",
  BOOT: "bot-cizme",
  SNEAKER: "sneaker",
  ESPADRILLE: "espadril",
  OXFORD_DERBY: "oxford-derby",
  CLOG: "clog",
  UNCLASSIFIED: "diger",
};

function sourceCategoryHaystack(category: SourceNativeCategory): string {
  return [category.categoryName, category.categoryPath, category.categoryId]
    .filter(Boolean)
    .join(" ");
}

function isGenericSourceCategory(category: SourceNativeCategory): boolean {
  const name = category.categoryName.trim();
  if (GENERIC_SOURCE_CATEGORY.test(name)) return true;
  const handle = (category.categoryPath ?? "").split("/").filter(Boolean).pop() ?? "";
  return GENERIC_SOURCE_CATEGORY.test(handle.replace(/-/g, " "));
}

export function isWeakCommercialCategory(category: SourceNativeCategory): boolean {
  if (isGenericSourceCategory(category)) return true;
  const name = category.categoryName.trim();
  if (WEAK_COMMERCIAL_NAME.test(name)) return true;
  const handle = (category.categoryPath ?? "").split("/").filter(Boolean).pop() ?? "";
  return WEAK_COMMERCIAL_NAME.test(handle.replace(/-/g, " "));
}

function pickPreferredMapping(
  hits: VisualMappedCategoryId[],
): VisualMappedCategoryId | null {
  const unique = [...new Set(hits)];
  if (unique.length === 0) return null;
  const structural = unique.filter((id) => STRUCTURAL_TYPES.includes(id));
  if (structural.length === 1) return structural[0]!;
  if (structural.length > 1) return null;
  return unique.includes("topuklu") ? "topuklu" : unique[0]!;
}

export function mapSourceCategoryToVisual(
  category: SourceNativeCategory,
): VisualMappedCategoryId | null {
  if (isGenericSourceCategory(category)) return null;
  const haystack = sourceCategoryHaystack(category);
  const hits = SOURCE_MAP_RULES.filter((rule) => rule.pattern.test(haystack)).map(
    (rule) => rule.id,
  );
  return pickPreferredMapping(hits);
}

export function mapPrimaryCategoryToVisual(
  primary: PrimaryFootwearCategory | null | undefined,
): VisualMappedCategoryId {
  if (!primary) return "diger";
  return PRIMARY_TO_VISUAL[primary] ?? "diger";
}

export function resolveVisualBasicCategory(
  family: Pick<ModelFamily, "sourceCategoryRefs" | "primaryCategory" | "taxonomy" | "basicCategory">,
): VisualMappedCategoryId {
  if (family.basicCategory) return family.basicCategory;

  const structural = new Set<VisualMappedCategoryId>();
  const weakHits = new Set<VisualMappedCategoryId>();

  for (const ref of family.sourceCategoryRefs ?? []) {
    const mapped = mapSourceCategoryToVisual(ref);
    if (!mapped) continue;
    if (isWeakCommercialCategory(ref)) {
      weakHits.add(mapped);
      continue;
    }
    structural.add(mapped);
  }

  if (structural.size === 1) return [...structural][0]!;

  if (structural.size > 1) {
    const withoutHeels = [...structural].filter((id) => id !== "topuklu");
    if (withoutHeels.length === 1) return withoutHeels[0]!;
    const primaryFallback = mapPrimaryCategoryToVisual(
      getFamilyPrimaryCategory(family as ModelFamily),
    );
    if (primaryFallback !== "diger") return primaryFallback;
    return "diger";
  }

  if (weakHits.size === 1) return [...weakHits][0]!;
  if (weakHits.size > 1) {
    const preferred = pickPreferredMapping([...weakHits]);
    if (preferred) return preferred;
  }

  return mapPrimaryCategoryToVisual(getFamilyPrimaryCategory(family as ModelFamily));
}

/** Alias used by Brand + Visual so there is one resolver. */
export const resolveBasicFootwearCategory = resolveVisualBasicCategory;

export function visualCategoryLabel(id: VisualBasicCategoryId): string {
  return VISUAL_BASIC_CATEGORIES.find((item) => item.id === id)?.label ?? id;
}

export interface BasicCategoryCount {
  id: VisualBasicCategoryId;
  label: string;
  count: number;
}

export function familyBasicCategory(family: ModelFamily): VisualMappedCategoryId {
  return family.basicCategory ?? resolveVisualBasicCategory(family);
}

export function countFamiliesByBasicCategory(families: ModelFamily[]): BasicCategoryCount[] {
  const counts = new Map<VisualMappedCategoryId, number>();
  for (const family of families) {
    const id = familyBasicCategory(family);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return VISUAL_BASIC_CATEGORIES.map((item) => ({
    id: item.id,
    label: item.label,
    count: item.id === "tumu" ? families.length : (counts.get(item.id as VisualMappedCategoryId) ?? 0),
  })).filter((item) => item.id === "tumu" || item.count > 0);
}

export function filterFamiliesByBasicCategory(
  families: ModelFamily[],
  categoryId: string | null,
): ModelFamily[] {
  if (!categoryId || categoryId === "tumu") return families;
  return families.filter((family) => familyBasicCategory(family) === categoryId);
}
