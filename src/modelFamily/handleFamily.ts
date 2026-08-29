import { extractShopifyHandle } from "./sourceIdentity";
import { hasDistinctiveModelToken, isGenericModelTitle } from "./genericModelTitle";

const COLOR_TOKENS = new Set([
  "black",
  "white",
  "brown",
  "tan",
  "beige",
  "red",
  "blue",
  "green",
  "silver",
  "gold",
  "cream",
  "creamy",
  "ivory",
  "nude",
  "navy",
  "grey",
  "gray",
  "pink",
  "camel",
  "cognac",
  "olive",
  "ecru",
  "mocha",
  "moka",
  "port",
  "cloud",
  "taupe",
  "khaki",
  "burgundy",
  "wine",
  "rose",
  "blush",
  "coral",
  "lilac",
  "purple",
  "yellow",
  "orange",
  "teal",
  "mint",
  "sage",
  "stone",
  "sand",
  "chocolate",
  "espresso",
  "chestnut",
  "natural",
  "offwhite",
  "off",
  "multi",
  "metallic",
  "dusty",
  "dark",
  "light",
  "deep",
  "glass",
  "moss",
  "tobacco",
  "scarlet",
  "hazelnut",
  "mahogany",
  "oxblood",
  "cranberry",
  "crimson",
  "walnut",
  "cocoa",
  "pine",
  "smoke",
  "bone",
  "cherry",
  "honey",
  "praline",
  "whiskey",
  "tortoise",
  "crystal",
  "platinum",
  "limewash",
  "onyx",
  "midnight",
  "lemon",
  "noir",
  "embossed",
  "caramel",
  "argent",
  "argente",
  "platine",
  "leopard",
  "marron",
  "ivoire",
  "bordeaux",
  "cognac",
  "abysse",
  "buff",
  "eggshell",
  "greige",
  "cedar",
  "oatmeal",
  "oat",
  "chalk",
  "parchment",
  "butter",
  "champagne",
  "rust",
  "terracotta",
  "mushroom",
  "pewter",
  "bronze",
  "copper",
  "merlot",
  "oxblood",
  "ink",
  "python",
]);

const COLORWAY_MATERIALS = new Set([
  "suede",
  "leather",
  "nappa",
  "patent",
  "lambskin",
  "calf",
  "snake",
  "nubuck",
  "croc",
  "croco",
  "python",
  "ponyhair",
  "calfskin",
  "laminated",
  "lamine",
  "laminé",
  "naplack",
  "verni",
  "vernis",
  "velours",
  "cuir",
]);

const CONSTRUCTION_BLOCKERS = new Set([
  "satin",
  "mesh",
  "resille",
  "cracked",
  "shearling",
  "macrame",
  "embroidered",
  "printed",
  "print",
  "wood",
  "clear",
  "raffia",
  "felt",
  "velvet",
  "glitter",
  "crystal",
  "platform",
  "wedge",
  "nylon",
  "lite",
  "sequin",
  "sequins",
  "sling",
  "slingback",
  "slingbacks",
  "broderie",
  "mule",
  "mules",
  "lace",
  "laceup",
  "tresse",
  "braided",
  "woven",
]);

const NOISE_TOKENS = new Set([
  "heel",
  "height",
  "mid",
  "high",
  "low",
  "flat",
  "flats",
  "dk",
  "lt",
  "mini",
  "and",
  "the",
  "x",
  "loafer",
  "loafers",
  "mocassin",
  "mocassins",
  "ballerine",
  "ballerines",
  "escarpin",
  "escarpins",
  "bottine",
  "bottines",
  "pump",
  "pumps",
  "sandal",
  "sandals",
  "sneaker",
  "sneakers",
  "boot",
  "boots",
  "babies",
  "baby",
  "avec",
  "brides",
  "bride",
]);

function isSeasonToken(token: string): boolean {
  return /^(?:p|u|r|s|ss|fw|aw)\d{2}$/i.test(token);
}

function isSchutzSkuToken(token: string): boolean {
  return /^s\d{10,}$/i.test(token);
}

function tokenizeHandle(handle: string): string[] {
  return handle
    .toLowerCase()
    .split("-")
    .map((token) => token.trim())
    .filter(Boolean);
}

function stripColorwayTokens(tokens: string[]): string[] {
  const parts = [...tokens];
  let changed = true;
  while (changed && parts.length > 1) {
    changed = false;
    const last = parts[parts.length - 1]!;
    if (
      COLOR_TOKENS.has(last) ||
      COLORWAY_MATERIALS.has(last) ||
      NOISE_TOKENS.has(last) ||
      isSeasonToken(last) ||
      isSchutzSkuToken(last)
    ) {
      parts.pop();
      changed = true;
    }
  }
  return parts;
}

function stemFromTokens(tokens: string[]): string | null {
  const stem = tokens.join("-");
  const asName = tokens.join(" ");
  if (!stem || isGenericModelTitle(asName)) return null;
  if (!hasDistinctiveModelToken(asName)) return null;
  if (!tokens.some((token) => token.length >= 3 && !COLOR_TOKENS.has(token) && !COLORWAY_MATERIALS.has(token))) {
    return null;
  }
  return stem;
}

export function shopifyHandleFamilyKey(productUrl: string): string | null {
  const handle = extractShopifyHandle(productUrl);
  if (!handle) return null;
  return stemFromTokens(stripColorwayTokens(tokenizeHandle(handle)));
}

export function handleFamiliesCompatible(urlA: string, urlB: string): boolean {
  const handleA = extractShopifyHandle(urlA);
  const handleB = extractShopifyHandle(urlB);
  if (!handleA || !handleB) return false;
  const tokensA = stripColorwayTokens(tokenizeHandle(handleA));
  const tokensB = stripColorwayTokens(tokenizeHandle(handleB));
  const stemA = stemFromTokens(tokensA);
  const stemB = stemFromTokens(tokensB);
  if (!stemA || !stemB || stemA !== stemB) return false;

  const extraA = tokensA.filter((token) => !tokensB.includes(token));
  const extraB = tokensB.filter((token) => !tokensA.includes(token));
  const extra = [...extraA, ...extraB];
  if (extra.some((token) => CONSTRUCTION_BLOCKERS.has(token))) return false;
  return true;
}
