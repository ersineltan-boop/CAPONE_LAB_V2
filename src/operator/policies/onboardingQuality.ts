import type {
  CaponeFootwearCategory,
  CategoryDecision,
  CategoryEvidence,
  CategoryEvidenceField,
  FootwearGateDecision,
  FootwearGateInput,
  ModelGroupingCandidate,
  NewArrivalEvidence,
} from "../types";
import { CAPONE_FOOTWEAR_CATEGORIES, CATEGORY_EVIDENCE_CHAIN } from "../types";

const VERSION_SUFFIX =
  /^(.*?)(?:\s+)(?:([0-9]+)|([ivxlcdm]+)|v(?:ersion)?\s*([0-9]+))$/i;

const REJECTED_IMAGE_HINTS =
  /\b(logo|badge|new[-_ ]?in|new[-_ ]?arrival|nav(?:igation)?|recommend(?:ed|ation)?|placeholder|icon|sprite|banner-promo)\b/i;

const NON_FOOTWEAR =
  /\b(bag|tote|handbag|clutch|belt|sock|tights?|jewelry|jewellery|necklace|earring|shipping|dust bag|care kit|cleaner|polish|insole|wallet|scarf)\b/i;

const MENS_HINT = /\b(men'?s|menswear|male|for him)\b/i;

type Lexicon = Record<string, CaponeFootwearCategory>;

const ENGLISH_LEXICON: Lexicon = {
  babet: "Babet",
  "ballet flat": "Babet",
  ballerina: "Babet",
  loafer: "Loafer",
  mule: "Mule",
  sandal: "Sandalet",
  sandals: "Sandalet",
  heel: "Topuklu",
  heels: "Topuklu",
  pump: "Topuklu",
  pumps: "Topuklu",
  sneaker: "Sneaker",
  sneakers: "Sneaker",
  trainer: "Sneaker",
  boot: "Bot",
  boots: "Bot",
  bootie: "Bot",
  "ankle boot": "Bot",
  "knee boot": "Çizme",
  "knee-high boot": "Çizme",
  "over the knee": "Çizme",
};

const ROMANIAN_LEXICON: Lexicon = {
  balerini: "Babet",
  balerina: "Babet",
  mocasini: "Loafer",
  mocasin: "Loafer",
  saboti: "Mule",
  sabot: "Mule",
  sandale: "Sandalet",
  sandalute: "Sandalet",
  "pantofi cu toc": "Topuklu",
  toc: "Topuklu",
  adidasi: "Sneaker",
  tenisi: "Sneaker",
  botine: "Bot",
  ghete: "Bot",
  cizme: "Çizme",
  cizma: "Çizme",
};

const TURKISH_LEXICON: Lexicon = {
  babet: "Babet",
  loafer: "Loafer",
  mule: "Mule",
  sandalet: "Sandalet",
  topuklu: "Topuklu",
  sneaker: "Sneaker",
  bot: "Bot",
  çizme: "Çizme",
  cizme: "Çizme",
};

function lexiconForLocale(locale: string): Lexicon | null {
  const normalized = locale.trim().toLowerCase();
  if (normalized === "ro" || normalized.startsWith("ro-")) return ROMANIAN_LEXICON;
  if (normalized === "tr" || normalized.startsWith("tr-")) return TURKISH_LEXICON;
  if (normalized === "en" || normalized.startsWith("en-")) return ENGLISH_LEXICON;
  return null;
}

export function localeRequiredForClassification(locale: string | null | undefined): boolean {
  return Boolean(locale && locale.trim());
}

export function assertLocaleReady(locale: string | null | undefined): void {
  if (!localeRequiredForClassification(locale)) {
    throw new Error("Locale is required before locale-sensitive classification");
  }
}

function normalizeToken(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lookupCategory(text: string, lexicon: Lexicon): CaponeFootwearCategory | null {
  const normalized = normalizeToken(text);
  if (!normalized) return null;
  if (lexicon[normalized]) return lexicon[normalized] ?? null;
  const entries = Object.entries(lexicon).sort((a, b) => b[0].length - a[0].length);
  for (const [token, category] of entries) {
    const pattern = new RegExp(`(?:^|\\s)${escapeRegex(token)}(?:$|\\s)`, "i");
    if (pattern.test(normalized)) return category;
  }
  return null;
}

function fieldValue(evidence: CategoryEvidence, field: CategoryEvidenceField): string | null {
  switch (field) {
    case "source_category":
      return evidence.sourceCategory ?? null;
    case "breadcrumb":
      return evidence.breadcrumb ?? null;
    case "product_type":
      return evidence.productType ?? null;
    case "structured_data":
      return evidence.structuredData ?? null;
    case "title_name":
      return evidence.titleName ?? null;
    case "url_slug":
      return evidence.urlSlug ?? null;
    case "product_attributes":
      return evidence.productAttributes ?? null;
    case "product_description":
      return evidence.productDescription ?? null;
    case "detail_page":
      return evidence.detailPage ?? null;
    default:
      return null;
  }
}

export function classifyFootwearCategory(evidence: CategoryEvidence): CategoryDecision {
  if (!localeRequiredForClassification(evidence.locale)) {
    return {
      status: "REVIEW",
      category: null,
      qaState: "insufficient_evidence",
      matchedField: null,
      reason: "Locale is required before locale-sensitive classification",
    };
  }

  const lexicon = lexiconForLocale(evidence.locale!);
  if (!lexicon) {
    return {
      status: "REVIEW",
      category: null,
      qaState: "insufficient_evidence",
      matchedField: null,
      reason: `No Operator lexicon for locale "${evidence.locale}" — do not guess with English fallback`,
    };
  }

  const combined = CATEGORY_EVIDENCE_CHAIN.map((field) => fieldValue(evidence, field))
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ");

  if (NON_FOOTWEAR.test(combined)) {
    return {
      status: "REVIEW",
      category: null,
      qaState: "non_footwear_suspect",
      matchedField: null,
      reason: "Non-footwear suspect — mark REVIEW, do not silently drop",
    };
  }

  for (const field of CATEGORY_EVIDENCE_CHAIN) {
    const value = fieldValue(evidence, field);
    if (!value?.trim()) continue;
    const category = lookupCategory(value, lexicon);
    if (category && (CAPONE_FOOTWEAR_CATEGORIES as readonly string[]).includes(category)) {
      return {
        status: "RESOLVED",
        category,
        qaState: "ok",
        matchedField: field,
        reason: `Resolved from ${field} in locale ${evidence.locale}`,
      };
    }
  }

  return {
    status: "REVIEW",
    category: null,
    qaState: "unresolved",
    matchedField: null,
    reason: "Unresolved after evidence escalation — Diğer is a QA state, not a final category",
  };
}

function stripVersion(name: string): { base: string; version: string | null } {
  const normalized = normalizeToken(name);
  const match = normalized.match(VERSION_SUFFIX);
  if (!match) return { base: normalized, version: null };
  return { base: (match[1] ?? normalized).trim(), version: (match[2] ?? match[3] ?? match[4] ?? null) };
}

export function modelsAreDistinctVersions(left: string, right: string): boolean {
  const a = stripVersion(left);
  const b = stripVersion(right);
  if (!a.base || a.base !== b.base) return false;
  if (a.version === b.version) return false;
  return Boolean(a.version || b.version);
}

function sharedStrongIdentity(left: ModelGroupingCandidate, right: ModelGroupingCandidate): boolean {
  const pairs: Array<[string | null | undefined, string | null | undefined]> = [
    [left.styleCode, right.styleCode],
    [left.parentProductId, right.parentProductId],
    [left.stableModelCode, right.stableModelCode],
    [left.sourceVariantGroup, right.sourceVariantGroup],
  ];
  return pairs.some(([a, b]) => Boolean(a && b && normalizeToken(a) === normalizeToken(b)));
}

function sharedSkuBase(left: ModelGroupingCandidate, right: ModelGroupingCandidate): boolean {
  return Boolean(
    left.skuBase &&
      right.skuBase &&
      normalizeToken(left.skuBase) === normalizeToken(right.skuBase),
  );
}

export function canGroupAsColorVariants(
  left: ModelGroupingCandidate,
  right: ModelGroupingCandidate,
): { merge: boolean; reason: string } {
  const leftName = left.normalizedModelName ?? "";
  const rightName = right.normalizedModelName ?? "";
  if (leftName && rightName && modelsAreDistinctVersions(leftName, rightName)) {
    return { merge: false, reason: "Distinct model versions must stay separate" };
  }

  if (sharedStrongIdentity(left, right)) {
    return { merge: true, reason: "Shared style/parent/model identity with color variants" };
  }

  if (sharedSkuBase(left, right)) {
    return { merge: true, reason: "Shared SKU base after proven color suffix removal" };
  }

  if (
    leftName &&
    rightName &&
    normalizeToken(leftName) === normalizeToken(rightName) &&
    left.color &&
    right.color &&
    normalizeToken(left.color) !== normalizeToken(right.color)
  ) {
    return { merge: true, reason: "Safe normalized model name with distinct colors" };
  }

  return { merge: false, reason: "Insufficient grouping evidence — do not merge" };
}

export function isRejectedGalleryImage(url: string, label?: string | null): boolean {
  return REJECTED_IMAGE_HINTS.test(url) || REJECTED_IMAGE_HINTS.test(label ?? "");
}

export function isSourceNewArrival(evidence: NewArrivalEvidence): boolean {
  if (evidence.sourceNewArrival) return true;
  if (evidence.sourceNewBadge) return true;
  if (evidence.sourcePublishedAt || evidence.sourceCreatedAt) return true;
  if (evidence.sourceCollection && /new|noutati|new-in|new arrivals/i.test(evidence.sourceCollection)) {
    return true;
  }
  return false;
}

export function collectedAtDoesNotImplyNewArrival(collectedAt: string): boolean {
  return !isSourceNewArrival({
    sourceNewArrival: false,
    collectedAt,
    sourceNewBadge: false,
    sourceCollection: null,
    sourcePublishedAt: null,
    sourceCreatedAt: null,
  });
}

export function evaluateFootwearGate(input: FootwearGateInput): FootwearGateDecision {
  const text = [input.title, input.categoryText, input.gender].filter(Boolean).join(" ");
  if (NON_FOOTWEAR.test(text)) {
    return { decision: "EXCLUDE", reason: "Non-footwear product" };
  }
  if (input.audience === "WOMENS" && MENS_HINT.test(text)) {
    return { decision: "EXCLUDE", reason: "Men's product in a women's collector" };
  }
  if (!input.title.trim()) {
    return { decision: "REVIEW", reason: "Uncertain product — do not delete silently" };
  }
  if (/\b(shoe|boot|sandal|loafer|mule|sneaker|heel|babet|bot|cizme|pantof|botine)\b/i.test(text)) {
    return { decision: "ACCEPT", reason: "Footwear evidence accepted" };
  }
  return { decision: "REVIEW", reason: "Uncertain product — mark REVIEW" };
}

export const ONBOARDING_QUALITY_GATES = [
  "locale_required_before_classification",
  "category_evidence_escalation",
  "diger_is_review_not_final",
  "color_variants_group_distinct_versions_do_not",
  "gallery_rejects_non_product_images",
  "new_arrival_requires_source_evidence",
  "footwear_gate_reviews_uncertain",
] as const;
