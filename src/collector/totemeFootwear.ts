import type { FootwearCategory } from "./types";
import {
  evaluateFootwearProduct,
  hasStrongFootwearSignal,
  hasStrongNonFootwearSignal,
  inferFootwearCategoryFromSignals,
  isMensOnlyProduct,
  type FootwearGateInput,
  type FootwearGateResult,
} from "./footwearGate";
import { normalizeCollectionPath } from "./fullCoveragePaths";

export const TOTEME_BRAND_ID = "toteme";
export const TOTEME_BRAND_NAME = "TOTEME";

const TOTEME_SHOE_COLLECTION_TOKEN =
  /(?:^|[^a-z])(?:shoes?|footwear|boots?|booties?|pumps?|mules?|flats?|sandals?|heels?|loafers?|sneakers?|slippers?|slides?|clogs?)(?:[^a-z]|$)/i;

const TOTEME_MIXED_COLLECTION =
  /new[-_ ]?season|new[-_ ]?in|new[-_ ]?arrivals?|shop[-_ ]?all|all[-_ ]?products|womenswear|ready[-_ ]?to[-_ ]?wear|^fw\d|^ps\d|^pf\d|clothing|apparel/i;

const TOTEME_ACCESSORY_COLLECTION = /\baccessor|\bbags?\b|\bhandbags?\b/;

const TOTEME_FOOTWEAR_TITLE =
  /\b(shoe|shoes|footwear|boot|boots|bootie|booties|sandal|sandals|pump|pumps|mule|mules|loafer|loafers|flat|flats|heel|heels|sneaker|sneakers|slipper|slippers|slide|slides|clog|clogs|ballerin|slingback|mary[- ]jane|wedge|espadrille)\b/i;

const TOTEME_APPAREL_TYPE =
  /\b(dress|dresses|skirt|skirts|trouser|trousers|pant|pants|jean|jeans|shirt|shirts|top|tops|knitwear|knit|sweater|sweaters|jacket|jackets|coat|coats|blazer|blazers|cardigan|hoodie|sweatshirt|lingerie|swimwear|clothing|apparel|ready to wear|rtw|jumpsuit|shorts)\b/i;

const TOTEME_BAG_TYPE =
  /\b(bag|bags|handbag|handbags|tote|totes|clutch|clutches|pouch|wallet|crossbody|shoulder bag)\b/i;

const TOTEME_ACCESSORY_TYPE =
  /\b(accessor(?:y|ies)|belt|belts|scarf|scarves|hat|hats|jewelry|jewellery|sunglasses|eyewear|wallet|wallets|passport)\b/i;

const TOTEME_FOOTWEAR_TYPE =
  /^(shoes?|footwear|boots?|sandals?|pumps?|mules?|flats?|heels?|loafers?|sneakers?|slippers?|slides?|clogs?)$/i;

const APPAREL_TITLE =
  /\b(dress|skirt|trouser|trousers|pant|pants|jean|shirt|knit|sweater|jacket|coat|blazer|cardigan|hoodie|blouse|jumpsuit|shorts)\b/i;

const BAG_TITLE =
  /\b(bag|handbag|tote|clutch|crossbody|pouch|wallet)\b/i;

const ACCESSORY_TITLE =
  /\b(belt|scarf|hat|cap|earring|necklace|bracelet|sunglasses|keychain|passport)\b/i;

export type TotemeRejectKind = "apparel" | "bag" | "accessory" | "uncertain";

export interface TotemeCollectStats {
  rawProductsSeen: number;
  footwearAccepted: number;
  apparelRejected: number;
  bagsAccessoriesRejected: number;
  uncertainRejected: number;
  collectionsCrawled: string[];
  auditCollections: string[];
  shoesAdminProductCount: number | null;
  shoesPublishedProductCount: number | null;
}

export function emptyTotemeCollectStats(): TotemeCollectStats {
  return {
    rawProductsSeen: 0,
    footwearAccepted: 0,
    apparelRejected: 0,
    bagsAccessoriesRejected: 0,
    uncertainRejected: 0,
    collectionsCrawled: [],
    auditCollections: [],
    shoesAdminProductCount: null,
    shoesPublishedProductCount: null,
  };
}

export function isTotemeSource(input: { id?: string; brand?: string }): boolean {
  return (
    input.id?.trim().toLowerCase() === TOTEME_BRAND_ID ||
    input.brand?.trim().toUpperCase() === TOTEME_BRAND_NAME
  );
}

function isDedicatedTotemeShoeHandle(handle: string): boolean {
  return /^(shoes?|footwear)([-_]|$)/i.test(handle.trim());
}

function hasTotemeShoeCollectionToken(handle: string, title: string): boolean {
  const hay = `${handle} ${title}`.toLowerCase().replace(/[-_/]/g, " ");
  return TOTEME_SHOE_COLLECTION_TOKEN.test(hay);
}

export function isTotemeFootwearCollection(handle: string, title = ""): boolean {
  const normalizedHandle = handle.trim().toLowerCase();
  const hay = `${normalizedHandle} ${title}`.toLowerCase().replace(/[-_/]/g, " ");
  if (/^men[-_]|[-_]mens?([-_]|$)/.test(normalizedHandle)) return false;
  if (/\bmen\b|\bmens\b|\bhomme\b/.test(hay) && !/\bwomen/.test(hay)) return false;
  if (TOTEME_MIXED_COLLECTION.test(hay) && !isDedicatedTotemeShoeHandle(normalizedHandle)) {
    return false;
  }
  if (TOTEME_ACCESSORY_COLLECTION.test(hay) && !isDedicatedTotemeShoeHandle(normalizedHandle)) {
    return false;
  }
  return hasTotemeShoeCollectionToken(normalizedHandle, title);
}

export function isTotemeFootwearCollectionPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const normalized = normalizeCollectionPath(path);
  const handle = normalized.replace(/^\/collections\//, "");
  return isTotemeFootwearCollection(handle, handle);
}

export function isTotemeAuditCollection(handle: string, title = ""): boolean {
  if (isTotemeFootwearCollection(handle, title)) return false;
  const hay = `${handle} ${title}`.toLowerCase().replace(/[-_/]/g, " ");
  if (/shop[- ]?all|all[- ]?products|^all$|frontpage/.test(hay)) return false;
  return /new[- ]?season|new[- ]?in|new[- ]?arrivals?|\bbags?\b|\bhandbags?\b|\baccessor/.test(hay);
}

export function hasTotemeFootwearTitle(input: Pick<FootwearGateInput, "title" | "handle">): boolean {
  return TOTEME_FOOTWEAR_TITLE.test(`${input.title} ${input.handle ?? ""}`);
}

export function classifyTotemeReject(input: FootwearGateInput): TotemeRejectKind {
  const type = (input.productType ?? "").trim();
  const text = `${input.title} ${input.handle ?? ""}`;
  if (TOTEME_BAG_TYPE.test(type) || (BAG_TITLE.test(text) && !hasTotemeFootwearTitle(input))) {
    return "bag";
  }
  if (
    TOTEME_ACCESSORY_TYPE.test(type) ||
    (ACCESSORY_TITLE.test(text) && !hasTotemeFootwearTitle(input))
  ) {
    return "accessory";
  }
  if (
    TOTEME_APPAREL_TYPE.test(type) ||
    (APPAREL_TITLE.test(text) && !hasTotemeFootwearTitle(input))
  ) {
    return "apparel";
  }
  return "uncertain";
}

export function recordTotemeDecision(
  stats: TotemeCollectStats,
  seenUrls: Set<string>,
  productUrl: string,
  accepted: boolean,
  input: FootwearGateInput,
): void {
  if (seenUrls.has(productUrl)) return;
  seenUrls.add(productUrl);
  stats.rawProductsSeen += 1;
  if (accepted) {
    stats.footwearAccepted += 1;
    return;
  }
  const kind = classifyTotemeReject(input);
  if (kind === "apparel") stats.apparelRejected += 1;
  else if (kind === "bag" || kind === "accessory") stats.bagsAccessoriesRejected += 1;
  else stats.uncertainRejected += 1;
}

function rejectToteme(kind: TotemeRejectKind | "mens-only"): FootwearGateResult {
  return {
    decision: kind === "uncertain" ? "EXCLUDE_UNCERTAIN_PRODUCT_TYPE" : "EXCLUDE_NON_FOOTWEAR",
    category: null,
    validationMethod: "NONE",
    matchedSignals: [`toteme:${kind}`],
  };
}

/**
 * Toteme is a mixed RTW store. New In / mixed accessories are not enough.
 * Membership in an authoritative women's footwear collection (e.g. /collections/shoes)
 * is strong positive evidence unless apparel/bag/accessory/mens evidence overrides it.
 */
export function evaluateTotemeFootwearProduct(input: FootwearGateInput): FootwearGateResult {
  const type = (input.productType ?? "").trim();
  const footwearType = TOTEME_FOOTWEAR_TYPE.test(type);
  const footwearTitle = hasTotemeFootwearTitle(input);
  const specificCollection = isTotemeFootwearCollectionPath(input.collectionPath);
  const text = `${input.title} ${input.handle ?? ""}`;

  if (isMensOnlyProduct(input)) return rejectToteme("mens-only");
  if (TOTEME_BAG_TYPE.test(type) && !footwearType) return rejectToteme("bag");
  if (TOTEME_APPAREL_TYPE.test(type) && !footwearType) return rejectToteme("apparel");
  if (TOTEME_ACCESSORY_TYPE.test(type) && !footwearType) return rejectToteme("accessory");
  if (!footwearType && BAG_TITLE.test(text)) return rejectToteme("bag");
  if (!footwearType && APPAREL_TITLE.test(text)) return rejectToteme("apparel");
  if (!footwearType && ACCESSORY_TITLE.test(text)) return rejectToteme("accessory");

  const nonFootwear = hasStrongNonFootwearSignal(input);
  if (nonFootwear && !specificCollection) {
    return rejectToteme(classifyTotemeReject(input));
  }
  if (
    nonFootwear &&
    specificCollection &&
    (TOTEME_BAG_TYPE.test(type) || TOTEME_APPAREL_TYPE.test(type) || TOTEME_ACCESSORY_TYPE.test(type))
  ) {
    return rejectToteme(classifyTotemeReject(input));
  }

  const generic = evaluateFootwearProduct({
    ...input,
    fromVerifiedFootwearCollection: specificCollection,
  });
  if (generic.decision === "ACCEPT_FOOTWEAR") {
    return {
      ...generic,
      matchedSignals: [...generic.matchedSignals, "toteme:footwear"],
    };
  }

  if (specificCollection && !TOTEME_BAG_TYPE.test(type) && !TOTEME_APPAREL_TYPE.test(type) && !TOTEME_ACCESSORY_TYPE.test(type)) {
    const category =
      inferFootwearCategoryFromSignals(input) ??
      inferFromTotemeTitle(input) ??
      "OTHER_FOOTWEAR";
    return {
      decision: "ACCEPT_FOOTWEAR",
      category,
      validationMethod: "VERIFIED_FOOTWEAR_COLLECTION",
      matchedSignals: ["toteme:authoritative-footwear-collection"],
    };
  }

  if ((footwearType || footwearTitle) && (specificCollection || (footwearType && footwearTitle))) {
    const category =
      inferFootwearCategoryFromSignals(input) ??
      (hasStrongFootwearSignal(input) ? "OTHER_FOOTWEAR" : null) ??
      inferFromTotemeTitle(input) ??
      "OTHER_FOOTWEAR";
    return {
      decision: "ACCEPT_FOOTWEAR",
      category,
      validationMethod: footwearType ? "PRODUCT_TYPE" : "TITLE_HANDLE_SUPPORT",
      matchedSignals: ["toteme:specific-footwear-evidence"],
    };
  }

  return rejectToteme("uncertain");
}

function inferFromTotemeTitle(input: FootwearGateInput): FootwearCategory | null {
  const text = `${input.title} ${input.handle ?? ""}`.toLowerCase();
  if (/\bboot/.test(text)) return /ankle/.test(text) ? "ANKLE_BOOT" : "BOOT";
  if (/\bsandal|\bslide/.test(text)) return "SANDAL";
  if (/\bpump|\bheel|\bslingback/.test(text)) return "PUMP";
  if (/\bmule|\bclog/.test(text)) return "MULE";
  if (/\bloafer/.test(text)) return "LOAFER";
  if (/\bflat|\bballerin|\bmary/.test(text)) return "BALLERINA";
  if (/\bsneaker/.test(text)) return "SNEAKER";
  if (/\bshoe/.test(text)) return "OTHER_FOOTWEAR";
  return null;
}
