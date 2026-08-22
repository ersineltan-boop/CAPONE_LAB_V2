import { cleanHeelHeight, extractColorFromName } from "./cleanText";
import { normalizeColorFamily } from "./normalize/colorFamily";
import { normalizeConstruction } from "./normalize/construction";
import { normalizeDetails } from "./normalize/details";
import { normalizeHeelHeightGroup } from "./normalize/heelHeightGroup";
import { normalizeHeelType } from "./normalize/heelType";
import { normalizeMaterialFamily } from "./normalize/materialFamily";
import { normalizeToeShape } from "./normalize/toeShape";
import type { AnalyzedProduct, PilotProductRaw } from "./types";

export function analyzeProduct(raw: PilotProductRaw): AnalyzedProduct {
  const cleanedColor = raw.color ?? extractColorFromName(raw.productName);
  const { group: heelHeightGroup, cleaned: cleanedHeelFromGroup } =
    normalizeHeelHeightGroup(raw.heelHeight, raw.productName, raw.material);
  const cleanedHeelHeight =
    cleanedHeelFromGroup ?? cleanHeelHeight(raw.heelHeight);

  const normalized = {
    category: raw.category,
    colorFamily: normalizeColorFamily(cleanedColor, raw.productName),
    materialFamily: normalizeMaterialFamily(raw.material, raw.productName),
    heelType: normalizeHeelType(
      raw.heelType,
      cleanedHeelHeight,
      raw.productName,
      raw.category,
    ),
    heelHeightGroup,
    toeShape: normalizeToeShape(raw.toeShape, raw.material, raw.productName),
    details: normalizeDetails(raw.productName, raw.details, raw.material),
    construction: normalizeConstruction(
      raw.productName,
      raw.category,
      raw.toeShape,
      raw.details,
      raw.material,
    ),
  };

  return {
    ...raw,
    cleaned: {
      heelHeight: cleanedHeelHeight,
      color: cleanedColor,
    },
    normalized,
  };
}

export function analyzeProducts(rawProducts: PilotProductRaw[]): AnalyzedProduct[] {
  return rawProducts.map(analyzeProduct);
}
