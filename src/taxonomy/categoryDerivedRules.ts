import { featureFromDerived, isKnown } from "./featureHelpers";
import type {
  FootwearTaxonomyGlobal,
  PrimaryFootwearCategory,
} from "./types";

/**
 * Safe category-derived feature rules.
 *
 * These are the ONLY derivations permitted without direct product-text evidence.
 * Absence of mention in product data must remain UNKNOWN — never infer a "normal" default.
 */
export const SAFE_CATEGORY_DERIVED_RULES = [
  {
    id: "MULE_BACKLESS",
    category: "MULE" as PrimaryFootwearCategory,
    field: "backConstruction" as const,
    value: "BACKLESS" as const,
    rationale:
      "Mule primary category requires backless construction by definition; assigned only when category itself is supported.",
  },
] as const;

export function applyCategoryDerivedFeatures(
  category: PrimaryFootwearCategory,
  global: FootwearTaxonomyGlobal,
): void {
  if (category === "MULE" && !isKnown(global.backConstruction)) {
    global.backConstruction = featureFromDerived("BACKLESS", 0.85);
  }
}
