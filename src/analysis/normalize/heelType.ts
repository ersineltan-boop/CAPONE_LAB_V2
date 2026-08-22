import { combineText } from "../cleanText";
import type { FootwearCategory } from "../../types/pilotProduct";
import type { HeelTypeNormalized } from "../types";

interface HeelRule {
  type: HeelTypeNormalized;
  keywords: string[];
}

const RULES: HeelRule[] = [
  { type: "WEDGE", keywords: ["wedge"] },
  { type: "STILETTO", keywords: ["stiletto", "stileto"] },
  { type: "KITTEN", keywords: ["kitten"] },
  { type: "BLOCK", keywords: ["block heel", "block"] },
  { type: "PLATFORM", keywords: ["platform"] },
  { type: "SCULPTURAL", keywords: ["sculptural", "opanka"] },
  { type: "FLAT", keywords: ["flat heel", "flat sole", "no heel", "flat"] },
];

export function normalizeHeelType(
  heelType: string | null,
  heelHeight: string | null,
  productName: string,
  category: FootwearCategory | null,
): HeelTypeNormalized {
  if (category === "WEDGE") return "WEDGE";

  const text = combineText([heelType, heelHeight, productName]);

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) return rule.type;
    }
  }

  if (heelType) {
    const first = heelType.split(/\s+/)[0]?.toLowerCase();
    if (first === "stiletto") return "STILETTO";
    if (first === "block") return "BLOCK";
    if (first === "wedge") return "WEDGE";
    if (first === "kitten") return "KITTEN";
    if (first === "flat") return "FLAT";
  }

  if (heelType && heelType.trim().length > 0) return "OTHER";
  return "UNKNOWN";
}
