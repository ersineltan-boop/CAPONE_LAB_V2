import type { RawAnalyzedProduct } from "./types";

function firstVariantSku(product: RawAnalyzedProduct): string | null {
  const sku = product.variants?.find((variant) => variant.sku)?.sku;
  return sku?.trim() || null;
}

function extractLarroudeStyleCode(value: string): string | null {
  const match = value.match(/\b(L\d+-[A-Z]{4})\b/i);
  return match ? match[1]!.toUpperCase() : null;
}

const PARIS_TEXAS_COLOR_SUFFIXES = [
  "BORGOGNA",
  "AMARENA",
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
  "BORDEAUX",
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
].sort((a, b) => b.length - a.length);

export function extractParisTexasStyleCode(sku: string): string | null {
  const upper = sku.trim().toUpperCase().replace(/_\d{1,2}$/, "");
  if (!/^PX\d{4}X/.test(upper)) return null;
  for (const color of PARIS_TEXAS_COLOR_SUFFIXES) {
    if (upper.endsWith(color) && upper.length - color.length >= 10) {
      return upper.slice(0, -color.length);
    }
  }
  return upper.length >= 10 ? upper : null;
}

export function extractBaseSku(sku: string): string | null {
  const trimmed = sku.trim();
  if (!trimmed) return null;

  const parisTexas = extractParisTexasStyleCode(trimmed);
  if (parisTexas) return parisTexas;

  const larroude = extractLarroudeStyleCode(trimmed);
  if (larroude) return larroude;

  // ST. AGNI style: S26-43154DOL-36
  const stAgni = trimmed.match(/^(S\d{2}-\d+[A-Z0-9]+)-\d{1,2}$/i);
  if (stAgni) return stAgni[1]!.toUpperCase();

  // Schutz numeric style: S2208700750004 -> S220870075
  if (/^S\d{12,}$/i.test(trimmed)) {
    return trimmed.slice(0, -4).toUpperCase();
  }

  // Generic trailing size suffix
  const withoutSize = trimmed.replace(/[-_]\d{1,2}$/, "");
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

export function extractStyleCode(product: RawAnalyzedProduct): string | null {
  const sku = firstVariantSku(product);
  if (sku) {
    const baseSku = extractBaseSku(sku);
    if (baseSku) return baseSku;
  }

  return extractStyleCodeFromUrl(product.productUrl);
}
