export const TAXONOMY_VISION_PROMPT_VERSION = "taxonomy-v1-1";
export const TAXONOMY_VISION_ACCEPT_THRESHOLD = 0.85;
export const TAXONOMY_VISION_MAX_IMAGES = 3;
export const TAXONOMY_VISION_DEFAULT_LIMIT = 40;

export const PROTECTED_EVIDENCE_SOURCES = new Set([
  "PRODUCT_PAGE",
  "STRUCTURED_DATA",
  "PRODUCT_TEXT",
  "COLLECTION_TAG",
]);

export const CRITICAL_VISION_FIELDS = [
  "toeShape",
  "toeLength",
  "backConstruction",
  "heelType",
  "heelHeightClass",
  "soleProfile",
  "platformConstruction",
  "shaftHeight",
] as const;

export const BLOCKED_VISION_FIELDS = new Set(["heelHeightMm"]);
