import { hasDistinctiveModelToken, isGenericModelTitle } from "./genericModelTitle";
import { normalizeModelName } from "./normalizeModelName";
import type { RawAnalyzedProduct } from "./types";

/** Colorway naming that does not change commercial construction by itself. */
const COLORWAY_SAFE_MATERIAL =
  /\b(leather|suede|patent|nappa|lambskin|calf|nubuck|cuir|verni|vernis|vernies|velours|tissu|grosgrain|kid|capretto|naplack)\b/gi;

const COLOR_DESCRIPTOR =
  /\b(black|white|brown|tan|nude|gold|silver|platinum|platine|burgundy|red|blue|bleu|pink|beige|cream|espresso|chocolate|chestnut|olive|olivine|ecru|ivory|ivoire|navy|grey|gray|milk|turquoise|denim|sky|metallic|chrome|vintage|mocha|cognac|camel|sand|rose|blush|coral|lilac|purple|green|yellow|orange|multicolor|multi|teal|tulip|oyster|eggplant|mushroom|lipstick|seaweed|puff|champagne|natural|moon|specchio|choc|bordo|bordeaux|maroon|wine|pearl|copper|bronze|charcoal|stone|sage|mint|lavender|fuchsia|magenta|mustard|rust|terracotta|aubergine|deep|light|dark|bright|pale|soft|rich|warm|cool|crystal|smoke|tortoise|chili|saddle|hazelnut|moka|port|cloud|taupe|khaki|maya|cactus|plum|lobster|burnt|umber|french|striped|printed|print|distressed|embossed|croc|croco|snake|python|blanc|noir|rouge|caramel|marine|brut|jean|petrol|ballet|bone|tumble|argent|argente|leopard|marron|ciel|noisette|chocolat|bourgogne|abysse|perfore|lamine|buff|olive|eggshell|greige|cedar|oatmeal|oat|chalk|parchment|butter|pewter|merlot|oxblood|ink)\b/gi;

const COLORWAY_SAFE_MATERIAL_EXTRA =
  /\b(calf\s+hair|pony\s*hair|ponyhair)\b/gi;

const NOISE =
  /\b(women'?s|womens|mens|unisex|new|sale|in|the|and|with|x|babies|baby|avec|brides|bride|et|escarpins|ballerines|bottines|mocassins|bottes|pumps|heeled|hair)\b/gi;

function collapse(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularizeCategoryTokens(value: string): string {
  return value.replace(
    /\b(slingbacks|ballerines|ballerinas|flats|heels|pumps|sandals|mules|loafers|booties|boots|sneakers|slides|wedges|thongs|escarpins|bottines|mocassins|bottes)\b/gi,
    (token) => {
      const lower = token.toLowerCase();
      if (lower === "booties") return "bootie";
      if (lower === "ballerines") return "ballerine";
      if (lower === "bottines") return "bottine";
      if (lower === "mocassins") return "mocassin";
      if (lower === "escarpins") return "escarpin";
      if (lower === "bottes") return "botte";
      if (lower.endsWith("s")) return lower.slice(0, -1);
      return lower;
    },
  );
}

/**
 * Strip only color + harmless colorway-material descriptors.
 * Structural materials (mesh, satin, vinyl, raffia, …) remain so lookalikes fail.
 */
export function stripColorwayDescriptors(title: string, knownColor?: string | null): string {
  let text = collapse(title);
  if (knownColor?.trim()) {
    const known = collapse(knownColor);
    if (known) {
      text = text.replace(new RegExp(`\\b${known.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
    }
  }
  return singularizeCategoryTokens(
    collapse(
      text
        .replace(COLOR_DESCRIPTOR, " ")
        .replace(COLORWAY_SAFE_MATERIAL, " ")
        .replace(COLORWAY_SAFE_MATERIAL_EXTRA, " ")
        .replace(NOISE, " "),
    ),
  );
}

export function titlesDifferOnlyByColorwayDescriptors(
  a: RawAnalyzedProduct,
  b: RawAnalyzedProduct,
): boolean {
  const left = stripColorwayDescriptors(a.productName, a.cleaned.color ?? a.color);
  const right = stripColorwayDescriptors(b.productName, b.cleaned.color ?? b.color);
  return Boolean(left) && left === right;
}

export function isSafeDistinctiveModelName(normalizedName: string): boolean {
  if (!normalizedName.trim()) return false;
  if (isGenericModelTitle(normalizedName)) return false;
  if (!hasDistinctiveModelToken(normalizedName)) return false;
  return true;
}

export function sameNormalizedDistinctiveName(
  a: RawAnalyzedProduct,
  b: RawAnalyzedProduct,
): boolean {
  const left = normalizeModelName(a.productName, {
    color: a.cleaned.color ?? a.color,
    colorFamily: a.normalized.colorFamily,
  });
  const right = normalizeModelName(b.productName, {
    color: b.cleaned.color ?? b.color,
    colorFamily: b.normalized.colorFamily,
  });
  if (left !== right) return false;
  return isSafeDistinctiveModelName(left);
}
