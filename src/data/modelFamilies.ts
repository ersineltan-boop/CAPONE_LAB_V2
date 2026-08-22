import modelFamiliesJson from "../../data/multibrand/model-families.json";
import type { ModelFamily } from "../modelFamily/types";

export const modelFamilies = modelFamiliesJson as ModelFamily[];

export const modelFamilyById = new Map(
  modelFamilies.map((family) => [family.modelFamilyId, family]),
);

export const modelFamilyByProductId = new Map<string, ModelFamily>();
for (const family of modelFamilies) {
  for (const productId of family.sourceProductIds) {
    modelFamilyByProductId.set(productId, family);
  }
}
