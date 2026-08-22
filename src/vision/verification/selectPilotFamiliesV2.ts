import { VISION_VERIFICATION_THRESHOLDS } from "./config";
import type { PilotFamilyCandidate } from "./types";
import type { ModelFamily } from "../../modelFamily/types";

/** V1 live pilot ile aynı 30 family — karşılaştırma için kilitli seçim. */
export function selectPilotFamiliesByIds(input: {
  families: ModelFamily[];
  modelFamilyIds: string[];
}): PilotFamilyCandidate[] {
  const familyById = new Map(
    input.families.map((family) => [family.modelFamilyId, family]),
  );

  const selected: PilotFamilyCandidate[] = [];

  for (const modelFamilyId of input.modelFamilyIds) {
    const family = familyById.get(modelFamilyId);
    if (!family) continue;
    if (family.representativeImages.length === 0) continue;

    selected.push({
      modelFamilyId: family.modelFamilyId,
      brand: family.brand,
      canonicalName: family.canonicalName,
      category: family.category,
      representativeProductId: family.representativeProductId,
      representativeImages: family.representativeImages.slice(
        0,
        VISION_VERIFICATION_THRESHOLDS.maxEvidenceImages,
      ),
      selectionScore: 0,
      selectionReasons: ["locked from v1 pilot"],
    });
  }

  return selected;
}

export const V2_AUDIT_PRIORITY_FAMILY_IDS = [
  "christen--singleton-https-christen-com-products-edge-thong-sandal",
  "christen--singleton-https-christen-com-products-helix-thong-sandal-2",
  "studio-amelia--singleton-https-studioamelia-com-au-products-cross-front-flat",
  "studio-amelia--singleton-https-studioamelia-com-au-products-flip-flop-75-heel",
  "jeffrey-campbell--singleton-https-jeffreycampbellshoes-com-products-faery",
  "steve-madden--singleton-https-stevemadden-com-products-viable",
  "tony-bianco--singleton-https-tonybianco-com-products-suave",
  "schutz--singleton-https-schutz-shoes-com-products-lyra-sandal",
  "maray--singleton-https-maraycollective-com-products-tuesday-sandal",
  "hereu--singleton-https-hereustudio-com-products-sardana-lace-up-woven-slingback-sandal-cherry",
] as const;
