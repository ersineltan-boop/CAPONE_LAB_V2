import type { RawAnalyzedProduct } from "./types";

export interface StyleIdentity {
  code: string | null;
  verified: boolean;
}

function firstVariantSku(product: RawAnalyzedProduct): string | null {
  const sku = product.variants?.find((variant) => variant.sku)?.sku;
  return sku?.trim() || null;
}

function extractLarroudeStyleCode(value: string): string | null {
  const match = value.match(/\b(L\d+-[A-Z]{4})\b/i);
  return match ? match[1]!.toUpperCase() : null;
}

const PARIS_TEXAS_COLOR_SUFFIXES = [
  "DARKTEXASROSE",
  "DARKCHOCOLATE",
  "TEXASROSE",
  "DESERTROSE",
  "ROUGENOIR",
  "DARKPHARD",
  "NATURALE",
  "BORGOGNA",
  "AMARENA",
  "PLATINO",
  "ARGENTO",
  "LAGUNA",
  "CARAMEL",
  "BORDEAUX",
  "ARDESIA",
  "FONDENTE",
  "MILITARE",
  "SIGARO",
  "KOALA",
  "MENTA",
  "PEACH",
  "TUNDRA",
  "EBANO",
  "CREAM",
  "CREMA",
  "BIANCO",
  "NERO",
  "ROSSO",
  "CUOIO",
  "SAHARA",
  "IVORY",
  "BLACK",
  "WHITE",
  "BROWN",
  "TAUPE",
  "BEIGE",
  "GOLD",
  "SILVER",
  "NUDE",
  "CAMEL",
  "OLIVE",
  "GREEN",
  "PINK",
  "BLUE",
  "WINE",
  "MARRONE",
  "GRIGIO",
  "NAVY",
  "COGNAC",
  "STONE",
  "MOSS",
  "KHAKI",
  "LILAC",
  "PURPLE",
  "ORANGE",
  "YELLOW",
  "MUSE",
  "ECRU",
  "TAN",
  "RED",
  "WENGE",
  "MOCHA",
  "JEANS",
  "PEPE",
  "SAND",
  "MORO",
  "TMORO",
  "OFF",
  "ARG",
].sort((a, b) => b.length - a.length);

export function extractParisTexasStyleCode(sku: string): string | null {
  let upper = sku.trim().toUpperCase().replace(/_\d{1,2}(?:\.\d)?$/, "");
  if (!/^PX\d{4}X/.test(upper)) return null;

  let changed = true;
  while (changed) {
    changed = false;
    upper = upper.replace(/-+$/, "");
    for (const color of PARIS_TEXAS_COLOR_SUFFIXES) {
      if (upper.endsWith(color) && upper.length - color.length >= 10) {
        upper = upper.slice(0, -color.length);
        changed = true;
        break;
      }
    }
  }

  const materialAndArticle = upper.match(/^(PX\d{4}X[A-Z]{2,8}\d{0,2})(\d{4,6})$/);
  if (materialAndArticle) {
    upper = materialAndArticle[1]!;
  }

  return upper.length >= 10 ? upper : null;
}

export function extractParisTexasColorFromSku(sku: string): string | null {
  const upper = sku.trim().toUpperCase().replace(/_\d{1,2}(?:\.\d)?$/, "");
  if (!/^PX\d{4}X/.test(upper)) return null;
  for (const color of PARIS_TEXAS_COLOR_SUFFIXES) {
    if (upper.endsWith(color) && upper.length - color.length >= 10) {
      return color;
    }
  }
  return null;
}

export function extractStaudStyleCode(sku: string): string | null {
  const upper = sku.trim().toUpperCase();
  const seasonal = upper.match(/^(F\d{2}[A-Z]\d{4})/);
  if (seasonal) return seasonal[1]!;
  const numeric = upper.match(/^(\d{2}-\d{4})(?:-|$)/);
  return numeric ? numeric[1]! : null;
}

export function extractSchutzStyleCode(sku: string): string | null {
  const trimmed = sku.trim();
  if (/^S\d{12,}$/i.test(trimmed)) {
    return trimmed.slice(0, -4).toUpperCase();
  }
  return null;
}

export function extractJeffreyCampbellStyleCode(sku: string): string | null {
  const match = sku.trim().match(/^([A-Z0-9]+(?:-[A-Z0-9]+)*)-\d{2,4}-\d{1,2}$/i);
  return match ? match[1]!.toUpperCase() : null;
}

function extractStAgniStyleCode(sku: string): string | null {
  const match = sku.trim().match(/^(S\d{2}-\d+[A-Z0-9]+)-\d{1,2}$/i);
  return match ? match[1]!.toUpperCase() : null;
}

export function extractAncientGreekStyleCode(sku: string): string | null {
  const match = sku.trim().match(/^(\d{4,6})_\d{3,5}_\d{4,6}$/);
  return match ? match[1]! : null;
}

export function extractAlohasStyleCode(sku: string): string | null {
  const match = sku.trim().match(/^(S\d{6})-\d{4}$/i);
  return match ? match[1]!.toUpperCase() : null;
}

export function extractHereuStyleCode(sku: string): string | null {
  const trimmed = sku.trim().toUpperCase();
  return /^[A-Z]{5,10}$/.test(trimmed) ? trimmed : null;
}

export function extractJudeStyleCode(sku: string): string | null {
  const match = sku.trim().toUpperCase().match(/^(?:FW|SS|PS|PF)\d{2}([A-Z]{2,3}\d{3})/);
  return match ? match[1]! : null;
}

export function extractLeMondeBerylStyleCode(sku: string): string | null {
  const match = sku.trim().toUpperCase().match(/^([A-Z]{3})-[A-Z]{3}-[A-Z]{3}(?:-\d+)?$/);
  return match ? match[1]! : null;
}

export function extractTonyBiancoStyleCode(sku: string): string | null {
  const match = sku.trim().toUpperCase().match(/^([A-Z]+)-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{1,2}$/);
  return match ? match[1]! : null;
}

export function extractSteveMaddenStyleCode(sku: string): string | null {
  const match = sku.trim().toUpperCase().match(/^([A-Z]{2,12})(?:-[A-Z]{1,6})?$/);
  return match ? match[1]! : null;
}

export function extractMaloneStyleCode(sku: string): string | null {
  const match = sku.trim().toUpperCase().match(/^(MAUREEN(?:\s+MS)?\s+FLAT)\s+\d+/);
  return match ? match[1]!.replace(/\s+/g, " ") : null;
}

function extractVerifiedSkuStyle(sku: string, source: string): string | null {
  if (source === "paris-texas") return extractParisTexasStyleCode(sku);
  if (source === "staud") return extractStaudStyleCode(sku);

  const larroude = extractLarroudeStyleCode(sku);
  if (larroude) return larroude;

  const stAgni = extractStAgniStyleCode(sku);
  if (stAgni) return stAgni;

  const schutz = extractSchutzStyleCode(sku);
  if (schutz) return schutz;

  if (source === "jeffrey-campbell") return extractJeffreyCampbellStyleCode(sku);
  if (source === "malone-souliers") return extractMaloneStyleCode(sku);
  return null;
}

export function extractSourceProvenStyle(product: RawAnalyzedProduct): string | null {
  const source = product.source.trim().toLowerCase();
  const sku = firstVariantSku(product);
  if (!sku) return null;
  if (source === "ancient-greek-sandals") return extractAncientGreekStyleCode(sku);
  if (source === "alohas") return extractAlohasStyleCode(sku);
  if (source === "hereu") return extractHereuStyleCode(sku);
  if (source === "jude") return extractJudeStyleCode(sku);
  if (source === "le-monde-beryl") return extractLeMondeBerylStyleCode(sku);
  if (source === "tony-bianco") return extractTonyBiancoStyleCode(sku);
  if (source === "steve-madden") return extractSteveMaddenStyleCode(sku);
  if (source === "malone-souliers") return extractMaloneStyleCode(sku);
  return null;
}

export function extractBaseSku(sku: string): string | null {
  const trimmed = sku.trim();
  if (!trimmed) return null;

  const verified =
    extractParisTexasStyleCode(trimmed) ??
    extractLarroudeStyleCode(trimmed) ??
    extractStAgniStyleCode(trimmed) ??
    extractSchutzStyleCode(trimmed) ??
    extractJeffreyCampbellStyleCode(trimmed) ??
    extractStaudStyleCode(trimmed);
  if (verified) return verified;

  const withoutSize = trimmed.replace(/[-_]\d{1,2}(?:\.\d)?$/, "");
  if (withoutSize !== trimmed && withoutSize.length >= 5) {
    return withoutSize.toUpperCase();
  }

  return trimmed.length >= 6 ? trimmed.toUpperCase() : null;
}

export function extractStyleCodeFromUrl(productUrl: string): string | null {
  const zara = productUrl.match(/-p(\d{5,})(?:\.html|$|\?)/i);
  if (zara) return `ZARA-${zara[1]}`;

  const larroude = extractLarroudeStyleCode(productUrl);
  if (larroude) return larroude;

  const schutzMatch = productUrl.match(/-s(\d{10,})(?:\/|$|\?)/i);
  if (schutzMatch) {
    const digits = schutzMatch[1]!;
    return `S${digits.slice(0, -4)}`.toUpperCase();
  }

  const stAgniImageStyle = productUrl.match(/S\d{2}-S\d{2}-\d{5}[A-Z]{3}/i);
  if (stAgniImageStyle) {
    return stAgniImageStyle[0]!.toUpperCase();
  }

  return null;
}

export function extractStyleIdentity(product: RawAnalyzedProduct): StyleIdentity {
  const source = product.source.trim().toLowerCase();
  const sku = firstVariantSku(product);

  if (source === "zara") {
    const code = extractStyleCodeFromUrl(product.productUrl);
    return { code, verified: Boolean(code) };
  }

  if (source === "ancient-greek-sandals" && sku) {
    const greek = extractAncientGreekStyleCode(sku);
    if (greek) return { code: greek, verified: true };
  }

  if (sku) {
    const verified = extractVerifiedSkuStyle(sku, source);
    if (verified) return { code: verified, verified: true };
  }

  const fromUrl = extractStyleCodeFromUrl(product.productUrl);
  if (fromUrl && !fromUrl.startsWith("ZARA-")) {
    return { code: fromUrl, verified: true };
  }

  if (sku) {
    const weak = extractBaseSku(sku);
    if (weak) return { code: weak, verified: false };
  }

  return { code: fromUrl, verified: false };
}

export function extractStyleCode(product: RawAnalyzedProduct): string | null {
  return extractStyleIdentity(product).code;
}
