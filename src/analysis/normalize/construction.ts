import { combineText } from "../cleanText";
import type { FootwearCategory } from "../../types/pilotProduct";
import type { ConstructionTag } from "../types";

interface ConstructionRule {
  tag: ConstructionTag;
  keywords: string[];
}

const RULES: ConstructionRule[] = [
  { tag: "SLINGBACK", keywords: ["slingback", "sling back", "sling-back"] },
  { tag: "OPEN_TOE", keywords: ["open toe", "opened toe", "open-toe"] },
  { tag: "PEEP_TOE", keywords: ["peep toe", "peep-toe"] },
  { tag: "T_STRAP", keywords: ["t-strap", "t strap"] },
  { tag: "ANKLE_STRAP", keywords: ["ankle strap", "multi strap", "strap heel", "strap slide", "strap sandal"] },
  { tag: "BACKLESS", keywords: ["backless", "mule heel", " mule"] },
  { tag: "CLOSED_TOE", keywords: ["closed toe", "round toe closure"] },
  { tag: "HIGH_VAMP", keywords: ["high vamp"] },
  { tag: "LOW_VAMP", keywords: ["low vamp", "ballet flat", "ballerina flat"] },
];

export function normalizeConstruction(
  productName: string,
  category: FootwearCategory | null,
  toeShape: string | null,
  details: string | null,
  material: string | null,
): ConstructionTag[] {
  const text = ` ${combineText([productName, toeShape, details, material])} `;
  const found: ConstructionTag[] = [];

  if (category === "SLINGBACK" && !found.includes("SLINGBACK")) {
    found.push("SLINGBACK");
  }
  if (category === "MULE" && !found.includes("BACKLESS")) {
    found.push("BACKLESS");
  }
  if (category === "THONG" && !found.includes("OPEN_TOE")) {
    found.push("OPEN_TOE");
  }

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
