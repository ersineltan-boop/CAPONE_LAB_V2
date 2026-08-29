import type { RawAnalyzedProduct } from "./types";

const FLAG_RULES: Array<{ id: string; pattern: RegExp }> = [
  { id: "mesh", pattern: /\bmesh\b|\br[eé]sille\b/i },
  { id: "shearling", pattern: /\bshearling\b/i },
  { id: "platform", pattern: /\bplatform\b/i },
  { id: "wood", pattern: /\b(?:x[- ]?wood|\bwood)\b/i },
  { id: "clear", pattern: /\b(?:x[- ]?clear|clear (?:sandal|heel|pump|mule|platform)|lucite)\b/i },
  { id: "slingback", pattern: /\bslingbacks?\b|\bsling\b/i },
  { id: "lite", pattern: /\blite\b|\bnylon\b/i },
  { id: "broderie", pattern: /\bbroderie\b/i },
  { id: "macrame", pattern: /\bmacrame\b/i },
  { id: "wedge", pattern: /\bwedges?\b/i },
  { id: "sequin", pattern: /\bsequin/i },
  { id: "satin", pattern: /\bsatin\b/i },
  { id: "raffia", pattern: /\braffia\b/i },
  { id: "cracked", pattern: /\bcracked\b/i },
  { id: "vinyl", pattern: /\bvinyl\b|\bjelly\b/i },
  { id: "laceup", pattern: /\blace[- ]?ups?\b/i },
  { id: "braided", pattern: /\btresse\b|\bbraided\b|\bwoven\b/i },
];

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function constructionBlob(product: RawAnalyzedProduct): string {
  return stripDiacritics(`${product.productName} ${product.productUrl}`);
}

function titleFlagsFromText(text: string): Set<string> {
  const flags = new Set<string>();
  for (const rule of FLAG_RULES) {
    if (rule.pattern.test(text)) flags.add(rule.id);
  }
  const lower = text.toLowerCase();
  if (/\bmules?\b/.test(lower)) flags.add("mule");
  // Prefer mule when title/url also mentions sandal (common handle noise on mule PDPs).
  if (/\bsandals?\b/.test(lower) && !flags.has("mule")) flags.add("sandal");
  // Prefer explicit PDP heel-height slug over marketing title mid/high wording.
  // SCHUTZ model names often say "High Block" while the URL uses heel-height-mid.
  const heelHeightSlug = lower.match(/heel[-_]?height[-_]?(low|mid|high)\b/);
  if (heelHeightSlug) {
    const bucket = heelHeightSlug[1];
    if (bucket === "mid") flags.add("mid");
    if (bucket === "high") flags.add("high");
  } else {
    if (/\bmid\b/.test(lower)) flags.add("mid");
    if (/\bhigh\b/.test(lower) && /\b(heel|pump|sandal|boot)\b/.test(lower)) flags.add("high");
  }
  return flags;
}

function flagsFor(product: RawAnalyzedProduct): Set<string> {
  return titleFlagsFromText(constructionBlob(product));
}

export function titleConstructionKey(productName: string): string {
  return [...titleFlagsFromText(productName)].sort().join("+") || "base";
}

export function productConstructionKey(product: RawAnalyzedProduct): string {
  return [...flagsFor(product)].sort().join("+") || "base";
}

function heelBucket(product: RawAnalyzedProduct): "flat" | "raised" | "unknown" {
  const height = product.normalized.heelHeightGroup;
  const type = product.normalized.heelType;
  if (height === "FLAT" || height === "LOW" || type === "FLAT") return "flat";
  if (height === "MID" || height === "HIGH") return "raised";
  // STILETTO/WEDGE/PLATFORM imply raised even when height is missing.
  // BLOCK alone with unknown height is often taxonomy noise on flats — treat as unknown.
  if (type === "STILETTO" || type === "WEDGE" || type === "SCULPTURAL" || type === "PLATFORM") {
    return "raised";
  }
  return "unknown";
}

export function constructionsCompatible(a: RawAnalyzedProduct, b: RawAnalyzedProduct): boolean {
  return constructionsCompatibleWithOptions(a, b, { ignoreFlags: [] });
}

/**
 * Verified same-style colorway merges may ignore vinyl-only material noise while
 * still blocking architecture and other material-treatment conflicts (mesh/wood/clear).
 */
export function constructionsCompatibleForVerifiedStyle(
  a: RawAnalyzedProduct,
  b: RawAnalyzedProduct,
): boolean {
  return constructionsCompatibleWithOptions(a, b, { ignoreFlags: ["vinyl"] });
}

function constructionsCompatibleWithOptions(
  a: RawAnalyzedProduct,
  b: RawAnalyzedProduct,
  options: { ignoreFlags: readonly string[] },
): boolean {
  const ignore = new Set(options.ignoreFlags);
  const flagsA = flagsFor(a);
  const flagsB = flagsFor(b);
  const exclusive = [
    ["mule", "sandal"],
    ["mid", "high"],
  ] as const;
  for (const [left, right] of exclusive) {
    if (flagsA.has(left) && flagsB.has(right) && !flagsA.has(right) && !flagsB.has(left)) {
      return false;
    }
    if (flagsB.has(left) && flagsA.has(right) && !flagsB.has(right) && !flagsA.has(left)) {
      return false;
    }
  }

  const structural = [
    "mesh",
    "shearling",
    "platform",
    "wood",
    "clear",
    "slingback",
    "lite",
    "broderie",
    "macrame",
    "wedge",
    "sequin",
    "satin",
    "raffia",
    "cracked",
    "vinyl",
    "laceup",
    "braided",
  ];
  for (const flag of structural) {
    if (ignore.has(flag)) continue;
    if (flagsA.has(flag) !== flagsB.has(flag)) return false;
  }

  const heelA = heelBucket(a);
  const heelB = heelBucket(b);
  if (heelA !== "unknown" && heelB !== "unknown" && heelA !== heelB) return false;
  return true;
}
