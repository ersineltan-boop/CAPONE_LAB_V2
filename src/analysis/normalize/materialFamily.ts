import { combineText } from "../cleanText";
import type { MaterialFamily } from "../types";

interface MaterialRule {
  family: MaterialFamily;
  keywords: string[];
}

const RULES: MaterialRule[] = [
  { family: "WOVEN_LEATHER", keywords: ["woven leather", "woven nappa", "woven"] },
  { family: "CROC_EFFECT", keywords: ["croco", "croc effect", "crocodile"] },
  { family: "METALLIC_LEATHER", keywords: ["metallic leather", "chrome leather"] },
  { family: "PATENT", keywords: ["patent"] },
  { family: "NAPPA", keywords: ["nappa"] },
  { family: "SUEDE", keywords: ["suede"] },
  { family: "NUBUCK", keywords: ["nubuck"] },
  { family: "SATIN", keywords: ["satin"] },
  { family: "MESH", keywords: ["mesh"] },
  { family: "VINYL_TPU", keywords: ["vinyl", "tpu", "pvc"] },
  { family: "TEXTILE", keywords: ["brocade", "nylon", "textile", "fabric", "denim"] },
  { family: "SYNTHETIC", keywords: ["synthetic", "faux", "pu leather", "vegan"] },
  {
    family: "LEATHER",
    keywords: [
      "leather",
      "sheep leather",
      "bovine",
      "capretto",
      "vintage",
      "lambskin",
      "calf",
    ],
  },
];

export function normalizeMaterialFamily(
  material: string | null,
  productName: string,
): MaterialFamily {
  const text = combineText([material, productName]);

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) return rule.family;
    }
  }

  if (material && material.trim().length > 0) return "OTHER";
  return "UNKNOWN";
}
