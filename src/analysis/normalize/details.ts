import { combineText } from "../cleanText";
import type { DetailTag } from "../types";

interface DetailRule {
  tag: DetailTag;
  keywords: string[];
}

const RULES: DetailRule[] = [
  { tag: "THONG", keywords: ["thong"] },
  { tag: "BRAIDED", keywords: ["braided", "braid"] },
  { tag: "WOVEN", keywords: ["woven"] },
  { tag: "FRINGE", keywords: ["fringe"] },
  { tag: "BUCKLE", keywords: ["buckle"] },
  { tag: "BOW", keywords: [" bow", "bow detail", "bow "] },
  { tag: "RUCHED", keywords: ["ruched", "gathered"] },
  { tag: "FLOWER", keywords: ["flower", "floral"] },
  { tag: "PEARL", keywords: ["pearl", "beaded"] },
  { tag: "STONE", keywords: ["stone", "crystal", "gem"] },
  { tag: "METAL_HARDWARE", keywords: ["metal hardware", "hardware", "chrome"] },
  { tag: "CHAIN", keywords: ["chain"] },
  { tag: "LACE_UP", keywords: ["lace up", "lace-up", "tie up", "tie-up"] },
  { tag: "STUD", keywords: ["stud"] },
  { tag: "CUT_OUT", keywords: ["cut out", "cut-out", "cutout"] },
  { tag: "ASYMMETRIC", keywords: ["asymmetric", "asymmetrical"] },
];

export function normalizeDetails(
  productName: string,
  details: string | null,
  material: string | null,
): DetailTag[] {
  const text = ` ${combineText([productName, details, material])} `;
  const found: DetailTag[] = [];

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword) && !found.includes(rule.tag)) {
        found.push(rule.tag);
        break;
      }
    }
  }

  return found;
}
