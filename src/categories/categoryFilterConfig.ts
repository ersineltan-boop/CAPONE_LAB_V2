import type { PrimaryFootwearCategory } from "../taxonomy/types";
import { PRIMARY_FOOTWEAR_CATEGORIES } from "../taxonomy/types";

/** Primary commercial categories shown first in the index grid. */
export const PRIMARY_DISPLAY_CATEGORIES = [
  "BALLET_FLAT",
  "LOAFER",
  "PUMP",
  "SANDAL",
  "MULE",
  "BOOT",
  "SNEAKER",
] as const satisfies readonly PrimaryFootwearCategory[];

export const SECONDARY_DISPLAY_CATEGORIES = [
  "ESPADRILLE",
  "OXFORD_DERBY",
  "CLOG",
] as const satisfies readonly PrimaryFootwearCategory[];

/** Consumer-facing categories — excludes UNCLASSIFIED. */
export const CONSUMER_FOOTWEAR_CATEGORIES = PRIMARY_FOOTWEAR_CATEGORIES.filter(
  (category) => category !== "UNCLASSIFIED",
);

export type TaxonomyFilterFieldId = string;

/**
 * Filter fields exposed per primary category.
 * Keys align with taxonomy global + categorySpecific field names.
 */
export const CATEGORY_FILTER_FIELDS: Record<
  Exclude<PrimaryFootwearCategory, "UNCLASSIFIED">,
  TaxonomyFilterFieldId[]
> = {
  BALLET_FLAT: [
    "backConstruction",
    "toeShape",
    "toeLength",
    "vampHeight",
    "throatShape",
    "strapConfiguration",
    "sideConstruction",
    "toplineConstruction",
    "heelHeightClass",
    "heelType",
    "soleProfile",
    "platformConstruction",
  ],
  LOAFER: [
    "backConstruction",
    "toeShape",
    "toeLength",
    "vampHeight",
    "apronConstruction",
    "loaferDetail",
    "heelHeightClass",
    "heelType",
    "soleProfile",
    "platformConstruction",
    "outsoleConstruction",
  ],
  PUMP: [
    "backConstruction",
    "toeShape",
    "toeLength",
    "vampHeight",
    "strapConfiguration",
    "sideConstruction",
    "toplineConstruction",
    "heelHeightClass",
    "heelType",
    "soleProfile",
    "platformConstruction",
  ],
  SANDAL: [
    "backConstruction",
    "toeShape",
    "toeLength",
    "upperCoverage",
    "ankleCoverage",
    "strapConfiguration",
    "heelHeightClass",
    "heelType",
    "soleProfile",
    "platformConstruction",
  ],
  MULE: [
    "backConstruction",
    "toeShape",
    "toeLength",
    "apronConstruction",
    "loaferDetail",
    "strapConfiguration",
    "heelHeightClass",
    "heelType",
    "soleProfile",
    "platformConstruction",
  ],
  BOOT: [
    "shaftHeight",
    "shaftFit",
    "shaftShape",
    "toeShape",
    "toeLength",
    "heelHeightClass",
    "heelType",
    "soleProfile",
    "platformConstruction",
    "closureFeatures",
    "bootStyleFeatures",
    "hardwareIntensity",
  ],
  SNEAKER: [
    "sneakerHeight",
    "toeShape",
    "soleProfile",
    "soleShape",
    "platformConstruction",
    "closureFeatures",
    "upperProfile",
    "styleArchetype",
    "panelComplexity",
    "outsoleVisualWeight",
  ],
  ESPADRILLE: [
    "toeShape",
    "upperConstruction",
    "espadrilleSoleHeight",
    "heelHeightClass",
    "platformConstruction",
  ],
  OXFORD_DERBY: [
    "toeShape",
    "toeLength",
    "lacingConstruction",
    "broguingLevel",
    "heelHeightClass",
    "heelType",
    "soleProfile",
    "platformConstruction",
  ],
  CLOG: [
    "baseConstruction",
    "toeShape",
    "heelHeightClass",
    "platformConstruction",
  ],
};

export function getFilterFieldsForCategory(
  category: PrimaryFootwearCategory,
): TaxonomyFilterFieldId[] {
  if (category === "UNCLASSIFIED") return [];
  return CATEGORY_FILTER_FIELDS[category];
}

export function isConsumerCategory(
  category: PrimaryFootwearCategory,
): category is Exclude<PrimaryFootwearCategory, "UNCLASSIFIED"> {
  return category !== "UNCLASSIFIED";
}
