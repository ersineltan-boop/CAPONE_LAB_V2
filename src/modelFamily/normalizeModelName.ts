const COLOR_WORDS =
  /\b(black|white|brown|tan|nude|gold|silver|platinum|burgundy|red|blue|pink|beige|cream|espresso|chocolate|chestnut|olive|olivine|ecru|ivory|navy|grey|gray|milk|turquoise|denim|sky|metallic|chrome|vintage|mocha|cognac|camel|sand|rose|blush|coral|lilac|purple|green|yellow|orange|multicolor|multi|teal|tulip|oyster|eggplant|mushroom|lipstick|seaweed|puff|champagne|natural|moon|specchio|choc|bordo|bordeaux|maroon|wine|pearl|copper|bronze|charcoal|stone|sage|mint|lavender|fuchsia|magenta|mustard|rust|terracotta|aubergine|deep|light|dark|bright|pale|soft|rich|warm|cool)\b/gi;

const MATERIAL_WORDS =
  /\b(leather|suede|patent|nappa|metallic|velvet|satin|mesh|snake|croco|croc|woven|knit|boucle|wool|cashmere|denim|canvas|synthetic|rubber|capretto|venice|vintage|raffia|vinyl|grosgrain|specchio|kid|naplack|brocat|brocade|tpu|clear)\b/gi;

const SEASON_SIZE_WORDS =
  /\b(p26|p25|p24|p\d+|s\d+|ss\d+|fw\d+|aw\d+|women'?s|mens|unisex|new|sale|in)\b/gi;

const TRAILING_COLOR_SUFFIX = /\s[-–—]\s+[A-Za-z][\w\s/.]+$/;

const MODEL_CATEGORY_PATTERNS = [
  /\b(ballet flat)\b/i,
  /\b(ankle boot)\b/i,
  /\b(knee boot)\b/i,
  /\b(chelsea boot)\b/i,
  /\b(platform sandal)\b/i,
  /\b(wedge mule)\b/i,
  /\b(wedge sandal)\b/i,
  /\b(low sandal)\b/i,
  /\b(high sandal)\b/i,
  /\b(sneaker)\b/i,
  /\b(loafer)\b/i,
  /\b(mule)\b/i,
  /\b(pump)\b/i,
  /\b(sandal)\b/i,
  /\b(bootie)\b/i,
  /\b(boot)\b/i,
  /\b(slide)\b/i,
  /\b(flat)\b/i,
  /\b(heel)\b/i,
  /\b(wedge)\b/i,
  /\b(thong)\b/i,
  /\b(slingback)\b/i,
  /\b(ballerina)\b/i,
];

export interface NormalizeModelNameInput {
  color?: string | null;
  colorFamily?: string | null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripKnownColorTokens(name: string, color: string | null | undefined): string {
  if (!color?.trim()) return name;

  let result = name;
  const normalizedColor = color.trim();

  result = result.replace(new RegExp(`\\b${escapeRegex(normalizedColor)}\\b`, "gi"), " ");

  for (const part of normalizedColor.split(/\s+/)) {
    if (part.length < 2) continue;
    result = result.replace(new RegExp(`\\b${escapeRegex(part)}\\b`, "gi"), " ");
  }

  return result;
}

function truncateAfterModelCategory(name: string): string {
  let bestEnd = -1;

  for (const pattern of MODEL_CATEGORY_PATTERNS) {
    const match = name.match(pattern);
    if (match?.index !== undefined) {
      const end = match.index + match[0].length;
      if (end > bestEnd) bestEnd = end;
    }
  }

  if (bestEnd >= 0) {
    return name.slice(0, bestEnd).trim();
  }

  return name;
}

function collapseWhitespace(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export function normalizeModelName(
  productName: string,
  input: NormalizeModelNameInput = {},
): string {
  let name = productName
    .replace(TRAILING_COLOR_SUFFIX, "")
    .replace(/\//g, " ");

  name = stripKnownColorTokens(name, input.color);
  name = name
    .replace(COLOR_WORDS, " ")
    .replace(MATERIAL_WORDS, " ")
    .replace(SEASON_SIZE_WORDS, " ")
    .replace(/[^a-zA-Z0-9\s'-]/g, " ");

  name = collapseWhitespace(name)
    .replace(/\bpatent leather\b/gi, " ")
    .replace(/\bleather upper\b/gi, " ");

  name = truncateAfterModelCategory(collapseWhitespace(name));

  return collapseWhitespace(name).toLowerCase();
}

export function buildCanonicalDisplayName(normalizedNames: string[]): string {
  const sorted = [...normalizedNames]
    .map((name) =>
      name
        .split(" ")
        .map((part) =>
          part.length <= 2
            ? part.toUpperCase()
            : part.charAt(0).toUpperCase() + part.slice(1),
        )
        .join(" "),
    )
    .sort((a, b) => a.length - b.length || a.localeCompare(b, "tr"));

  return sorted[0] ?? "Model";
}
