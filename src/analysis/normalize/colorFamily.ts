import { extractColorFromName } from "../cleanText";
import type { ColorFamily } from "../types";

interface ColorRule {
  family: ColorFamily;
  keywords: string[];
}

const RULES: ColorRule[] = [
  { family: "MULTICOLOR", keywords: ["multi", "multicolor", "two-tone", "bicolor"] },
  { family: "BURGUNDY", keywords: ["burgundy", "wine", "vino", "oxblood", "maroon"] },
  { family: "ESPRESSO", keywords: ["espresso"] },
  { family: "SILVER", keywords: ["silver", "platinum", "chrome"] },
  { family: "GOLD", keywords: ["gold", "golden"] },
  { family: "METALLIC_OTHER", keywords: ["metallic"] },
  { family: "BLACK", keywords: ["black", "noir", "onyx", "ebony"] },
  { family: "WHITE", keywords: ["white", "off white", "off-white"] },
  { family: "CREAM", keywords: ["cream", "ivory", "ecru", "papyrus", "vanilla", "milk"] },
  { family: "BEIGE", keywords: ["beige", "taupe", "sand", "nude", "almond", "savannah"] },
  { family: "TAN", keywords: ["tan", "camel", "cognac"] },
  {
    family: "BROWN",
    keywords: [
      "brown",
      "chestnut",
      "chocolate",
      "choc",
      "coffee",
      "toffee",
      "chestnut",
      "rock",
      "willow",
      "peru",
    ],
  },
  { family: "RED", keywords: ["red", "crimson", "scarlet"] },
  { family: "PINK", keywords: ["pink", "blush", "petal", "rose"] },
  { family: "ORANGE", keywords: ["orange", "coral", "apricot"] },
  { family: "YELLOW", keywords: ["yellow", "lemon", "mustard"] },
  { family: "GREEN", keywords: ["green", "olive", "mint", "sage", "dark olive"] },
  { family: "BLUE", keywords: ["blue", "sky", "turquoise", "indigo", "denim", "navy", "teal"] },
  { family: "PURPLE", keywords: ["purple", "violet", "lilac", "lavender"] },
];

function matchColor(text: string): ColorFamily | null {
  if (text.includes("/")) {
    const slashParts = text.split("/").map((p) => p.trim()).filter(Boolean);
    if (slashParts.length >= 2) {
      const families = new Set(
        slashParts.map((part) => matchSingleColor(part)).filter((f) => f && f !== "UNKNOWN"),
      );
      if (families.size >= 2) return "MULTICOLOR";
      if (families.size === 1) return [...families][0] as ColorFamily;
    }
  }
  return matchSingleColor(text);
}

function matchSingleColor(text: string): ColorFamily | null {
  const lower = text.toLowerCase();
  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (containsWord(lower, keyword)) return rule.family;
    }
  }
  return null;
}

function containsWord(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s/,-])${escaped}(?:$|[\\s/,-])`, "i").test(` ${text} `);
}

export function normalizeColorFamily(
  color: string | null,
  productName: string,
): ColorFamily {
  const sources = [color, extractColorFromName(productName), productName].filter(
    (v): v is string => Boolean(v),
  );

  for (const source of sources) {
    const matched = matchColor(source);
    if (matched) return matched;
  }

  return "UNKNOWN";
}
