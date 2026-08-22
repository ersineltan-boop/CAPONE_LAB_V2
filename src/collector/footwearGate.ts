import type { FootwearCategory } from "./types";

export type FootwearGateDecision =
  | "ACCEPT_FOOTWEAR"
  | "EXCLUDE_NON_FOOTWEAR"
  | "EXCLUDE_UNCERTAIN_PRODUCT_TYPE";

export type FootwearValidationMethod =
  | "VERIFIED_FOOTWEAR_COLLECTION"
  | "PRODUCT_TYPE"
  | "TAGS"
  | "TITLE_HANDLE_SUPPORT"
  | "STORED_PRODUCT_REVIEW"
  | "NONE";

export interface FootwearGateInput {
  title: string;
  productType?: string;
  tags?: string[];
  handle?: string;
  collectionPath?: string;
  fromVerifiedFootwearCollection?: boolean;
}

export interface FootwearGateResult {
  decision: FootwearGateDecision;
  category: FootwearCategory | null;
  validationMethod: FootwearValidationMethod;
  matchedSignals: string[];
}

const STRONG_NON_FOOTWEAR_TERMS = [
  "BAG",
  "HANDBAG",
  "TOTE",
  "CLUTCH",
  "WALLET",
  "BELT",
  "SCARF",
  "HAT",
  "CAP",
  "JEWELRY",
  "JEWELLERY",
  "EARRING",
  "NECKLACE",
  "BRACELET",
  "SUNGLASSES",
  "EYEWEAR",
  "PERFUME",
  "FRAGRANCE",
  "CANDLE",
  "BEAUTY",
  "DRESS",
  "SKIRT",
  "TROUSER",
  "TROUSERS",
  "PANTS",
  "JEANS",
  "SHIRT",
  "TOP",
  "T-SHIRT",
  "TSHIRT",
  "KNITWEAR",
  "SWEATER",
  "JACKET",
  "COAT",
  "BLAZER",
  "SWIMWEAR",
  "UNDERWEAR",
  "SOCKS",
  "CROSSBODY",
  "POUCH",
  "KEYCHAIN",
  "ACCESSOR",
  "LIPSTICK",
  "MAKEUP",
  "COSMETIC",
  "GIFT CARD",
];

const FOOTWEAR_ALLOWLIST_TERMS = [
  "SHOES",
  "FOOTWEAR",
  "PUMPS",
  "PUMP",
  "HEELS",
  "HEEL",
  "SANDALS",
  "SANDAL",
  "BALLET FLATS",
  "BALLET FLAT",
  "FLATS",
  "FLAT SHOE",
  "LOAFERS",
  "LOAFER",
  "MULES",
  "MULE",
  "BOOTS",
  "BOOT",
  "ANKLE BOOTS",
  "ANKLE BOOT",
  "SNEAKERS",
  "SNEAKER",
  "SLIDES",
  "SLIDE",
  "SLIPPERS",
  "SLIPPER",
  "ESPADRILLES",
  "ESPADRILLE",
  "MARY JANES",
  "MARY JANE",
  "CLOGS",
  "CLOG",
  "WEDGES",
  "WEDGE",
  "SLINGBACK",
  "THONG",
  "FLIP FLOP",
];

const NON_FOOTWEAR_PATTERNS = [
  /\bhandbag/i,
  /\bclutch/i,
  /\bbag\b/i,
  /\btote\b/i,
  /\bcrossbody/i,
  /\bshoe care/i,
  /\bcare kit/i,
  /\baccessories\b/i,
  /\bjewell?ery/i,
  /\bearring/i,
  /\bnecklace/i,
  /\bracelet/i,
  /\bring\b/i,
  /\bwallet\b/i,
  /\bpouch\b/i,
  /\bkeychain/i,
  /\bsock/i,
  /\bperfume/i,
  /\bfragrance/i,
  /\bcandle/i,
  /\bbeauty\b/i,
  /\bdress\b/i,
  /\bskirt\b/i,
  /\btrouser/i,
  /\bpants\b/i,
  /\bjeans\b/i,
  /\bshirt\b/i,
  /\btop\b/i,
  /\bt-?shirt/i,
  /\bknitwear/i,
  /\bsweater/i,
  /\bjacket\b/i,
  /\bcoat\b/i,
  /\bblazer/i,
  /\bswimwear/i,
  /\bunderwear/i,
  /\bscarf/i,
  /\bbelt\b/i,
  /\bhat\b/i,
  /\bsunglasses/i,
  /\beyewear/i,
  /\blipstick/i,
  /\bmakeup/i,
  /\bcosmetic/i,
  /\bgift[- ]card/i,
  /\beau de parfum/i,
  /\bedp\b/i,
  /\bcologne/i,
  /Category~Handbags/i,
  /dept:Accessories/i,
  /StyleName~BAG-/i,
];

const FOOTWEAR_COLLECTION_HINT =
  /shoe|footwear|heel|sandal|boot|flat|pump|mule|loafer|sneaker|women|womens/i;

const MENS_ONLY_HINT = /\bmen'?s\b|\bmens\b|\bhomme\b|\bman\b|\bboy?s\b/i;
const WOMENS_HINT = /\bwomen'?s\b|\bwomens\b|\bfemme\b|\bladies\b|\bwoman\b|\bgirl?s\b/i;

function normalizeToken(value: string): string {
  return value.trim().toUpperCase();
}

function containsTerm(haystack: string, terms: string[]): string | null {
  const upper = normalizeToken(haystack);
  for (const term of terms) {
    const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(upper)) return term;
  }
  return null;
}

function joinSignals(parts: Array<string | undefined | null>): string {
  return parts.filter(Boolean).join(" ");
}

export function isFootwearCollectionPath(path: string): boolean {
  return FOOTWEAR_COLLECTION_HINT.test(path);
}

export function isVerifiedFootwearCollectionPath(path: string): boolean {
  const normalized = path.toLowerCase();
  if (!isFootwearCollectionPath(normalized)) return false;
  if (/\ball\b|\bnew-arrivals\b|\bshop-all\b|\bbest-sellers\b/.test(normalized)) {
    return false;
  }
  return true;
}

export function extractHandleFromProductUrl(productUrl: string): string {
  try {
    const pathname = new URL(productUrl).pathname;
    const match = pathname.match(/\/products\/([^/?#]+)/i);
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

export function hasStrongNonFootwearSignal(input: FootwearGateInput): string | null {
  const haystack = joinSignals([
    input.title,
    input.productType,
    ...(input.tags ?? []),
    input.handle,
  ]);

  const footwearOverride = hasTitleHandleFootwearSupport(input);

  if (input.handle && /^bag/i.test(input.handle)) return "handle:bag";
  if (input.handle && /^b-/i.test(input.handle) && /\bbag\b/i.test(haystack)) {
    return "handle:bag-prefix";
  }
  if (/\bgift[- ]card/i.test(haystack)) return "gift-card";
  if (/\blipstick/i.test(haystack)) return "lipstick";
  if (/\bmakeup/i.test(haystack)) return "makeup";

  for (const pattern of NON_FOOTWEAR_PATTERNS) {
    if (pattern.test(haystack)) {
      if (
        footwearOverride &&
        (pattern.source.includes("scarf") || pattern.source.includes("belt"))
      ) {
        continue;
      }
      return pattern.source;
    }
  }

  const typeHit = containsTerm(input.productType ?? "", STRONG_NON_FOOTWEAR_TERMS);
  if (typeHit) return `product_type:${typeHit}`;

  for (const tag of input.tags ?? []) {
    const tagHit = containsTerm(tag, STRONG_NON_FOOTWEAR_TERMS);
    if (tagHit) return `tag:${tagHit}`;
  }

  return null;
}

export function hasStrongFootwearSignal(input: FootwearGateInput): {
  method: FootwearValidationMethod;
  signal: string;
} | null {
  const typeHit = containsTerm(input.productType ?? "", FOOTWEAR_ALLOWLIST_TERMS);
  if (typeHit) return { method: "PRODUCT_TYPE", signal: typeHit };

  for (const tag of input.tags ?? []) {
    const tagHit = containsTerm(tag, FOOTWEAR_ALLOWLIST_TERMS);
    if (tagHit) return { method: "TAGS", signal: tagHit };
  }

  return null;
}

export function inferFootwearCategoryFromSignals(input: FootwearGateInput): FootwearCategory | null {
  const text = joinSignals([input.title, input.productType, ...(input.tags ?? [])]).toLowerCase();

  if (/\bthong\b|\bflip flop\b/.test(text)) return "THONG";
  if (/\bankle boot|\bankle-boot/.test(text)) return "ANKLE_BOOT";
  if (/\bknee[- ]high boot|\bknee boot|\bboot\b/.test(text)) return "BOOT";
  if (/\bsling[- ]?back|\bslingback/.test(text)) return "SLINGBACK";
  if (/\bballerin|\bballet flat|\bflat shoe|\bcasual flat/.test(text)) return "BALLERINA";
  if (/\bmary jane/.test(text)) return "MARY_JANE";
  if (/\bloafer/.test(text)) return "LOAFER";
  if (/\bmule/.test(text)) return "MULE";
  if (/\bwedge/.test(text)) return "WEDGE";
  if (/\bsneaker|\btrainer/.test(text)) return "SNEAKER";
  if (/\bsandal|\bslide/.test(text)) return "SANDAL";
  if (/\bpump|\bheel|\bstiletto|\bkitten/.test(text)) return "PUMP";

  const strong = hasStrongFootwearSignal(input);
  if (strong) return "OTHER_FOOTWEAR";

  return null;
}

function hasTitleHandleFootwearSupport(input: FootwearGateInput): string | null {
  const text = joinSignals([input.title, input.handle]).toLowerCase();
  const hits = [
    /\bshoe/i,
    /\bfootwear/i,
    /\bsandal/i,
    /\bboot/i,
    /\bpump/i,
    /\bheel/i,
    /\bflat/i,
    /\bloafer/i,
    /\bmule/i,
    /\bsneaker/i,
    /\bslide/i,
    /\bslipper/i,
    /\bwedge/i,
    /\bespar/i,
    /\bslingback/i,
    /\bclog/i,
  ];
  for (const pattern of hits) {
    if (pattern.test(text)) return pattern.source;
  }
  return null;
}

export function isMensOnlyProduct(input: FootwearGateInput): boolean {
  const text = joinSignals([input.title, input.productType, ...(input.tags ?? []), input.handle]);
  if (WOMENS_HINT.test(text)) return false;
  return MENS_ONLY_HINT.test(text);
}

export function evaluateFootwearProduct(input: FootwearGateInput): FootwearGateResult {
  const matchedSignals: string[] = [];

  const nonFootwear = hasStrongNonFootwearSignal(input);
  if (nonFootwear) {
    return {
      decision: "EXCLUDE_NON_FOOTWEAR",
      category: null,
      validationMethod: "NONE",
      matchedSignals: [nonFootwear],
    };
  }

  if (isMensOnlyProduct(input)) {
    return {
      decision: "EXCLUDE_NON_FOOTWEAR",
      category: null,
      validationMethod: "NONE",
      matchedSignals: ["mens-only"],
    };
  }

  const strongFootwear = hasStrongFootwearSignal(input);
  if (strongFootwear) {
    matchedSignals.push(`${strongFootwear.method}:${strongFootwear.signal}`);
    const category = inferFootwearCategoryFromSignals(input);
    if (category) {
      return {
        decision: "ACCEPT_FOOTWEAR",
        category,
        validationMethod: strongFootwear.method,
        matchedSignals,
      };
    }
  }

  if (input.fromVerifiedFootwearCollection) {
    const titleSupport = hasTitleHandleFootwearSupport(input);
    if (titleSupport) {
      matchedSignals.push(`title:${titleSupport}`);
      const category = inferFootwearCategoryFromSignals(input);
      if (category) {
        return {
          decision: "ACCEPT_FOOTWEAR",
          category,
          validationMethod: "VERIFIED_FOOTWEAR_COLLECTION",
          matchedSignals,
        };
      }
    }
  }

  const titleSupport = hasTitleHandleFootwearSupport(input);
  if (titleSupport && strongFootwear) {
    matchedSignals.push(`title:${titleSupport}`);
    const category = inferFootwearCategoryFromSignals(input);
    if (category) {
      return {
        decision: "ACCEPT_FOOTWEAR",
        category,
        validationMethod: "TITLE_HANDLE_SUPPORT",
        matchedSignals,
      };
    }
  }

  return {
    decision: "EXCLUDE_UNCERTAIN_PRODUCT_TYPE",
    category: null,
    validationMethod: "NONE",
    matchedSignals,
  };
}

export function evaluateStoredPilotProduct(input: {
  productName: string;
  productUrl: string;
  category: FootwearCategory | null;
}): FootwearGateResult {
  const handle = extractHandleFromProductUrl(input.productUrl);

  const nonFootwearGate = evaluateFootwearProduct({
    title: input.productName,
    productType: "",
    tags: [],
    handle,
  });

  if (nonFootwearGate.decision === "EXCLUDE_NON_FOOTWEAR") {
    return {
      ...nonFootwearGate,
      validationMethod: "STORED_PRODUCT_REVIEW",
    };
  }

  const titleSupport = hasTitleHandleFootwearSupport({
    title: input.productName,
    handle,
  });

  if (input.category && input.category !== "OTHER_FOOTWEAR") {
    return {
      decision: "ACCEPT_FOOTWEAR",
      category: input.category,
      validationMethod: "STORED_PRODUCT_REVIEW",
      matchedSignals: ["stored-footwear-category"],
    };
  }

  if (input.category === "OTHER_FOOTWEAR" && titleSupport) {
    return {
      decision: "ACCEPT_FOOTWEAR",
      category: input.category,
      validationMethod: "STORED_PRODUCT_REVIEW",
      matchedSignals: [`stored-category-with-title:${titleSupport}`],
    };
  }

  if (!titleSupport) {
    return {
      decision: "EXCLUDE_UNCERTAIN_PRODUCT_TYPE",
      category: null,
      validationMethod: "STORED_PRODUCT_REVIEW",
      matchedSignals: ["insufficient-footwear-evidence"],
    };
  }

  return {
    decision: "ACCEPT_FOOTWEAR",
    category: input.category,
    validationMethod: "STORED_PRODUCT_REVIEW",
    matchedSignals: [`title:${titleSupport}`],
  };
}

// Backward-compatible helpers used by legacy imports/tests.
export function isNonFootwear(input: {
  title: string;
  productType: string;
  tags: string[];
  handle: string;
}): boolean {
  return (
    evaluateFootwearProduct({
      title: input.title,
      productType: input.productType,
      tags: input.tags,
      handle: input.handle,
    }).decision === "EXCLUDE_NON_FOOTWEAR"
  );
}

export function normalizeFootwearCategory(input: {
  title: string;
  productType: string;
  tags: string[];
}): FootwearCategory | null {
  return evaluateFootwearProduct({
    title: input.title,
    productType: input.productType,
    tags: input.tags,
    handle: "",
  }).category;
}
