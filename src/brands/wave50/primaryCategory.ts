import type { FootwearCategory } from "../../collector/types";
import type { PrimaryFootwearCategory } from "../../taxonomy/types";

const PRODUCT_TYPE_PRIMARY: Record<string, PrimaryFootwearCategory> = {
  boot: "BOOT",
  boots: "BOOT",
  flat: "BALLET_FLAT",
  flats: "BALLET_FLAT",
  heel: "PUMP",
  heels: "PUMP",
  loafer: "LOAFER",
  loafers: "LOAFER",
  sneaker: "SNEAKER",
  sneakers: "SNEAKER",
  mule: "MULE",
  mules: "MULE",
  sandal: "SANDAL",
  sandals: "SANDAL",
  slide: "SANDAL",
  slides: "SANDAL",
  "sandals/slides": "SANDAL",
  slipper: "LOAFER",
  slippers: "LOAFER",
  mocassim: "LOAFER",
  mocassins: "LOAFER",
  mocassin: "LOAFER",
  pump: "PUMP",
  pumps: "PUMP",
  "boat shoe": "LOAFER",
  "mary jane": "BALLET_FLAT",
  belgian: "LOAFER",
};

function normalizeType(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Socks, bags, and other non-shoes sometimes share a generic product type
 * such as "Chaussures". Title evidence keeps them off brand pages.
 */
export function isNonFootwearCatalogItem(input: { title?: string | null }): boolean {
  const title = (input.title ?? "").toLowerCase();
  if (/\bchaussettes?\b|\bsocks?\b/.test(title)) return true;
  if (/\bsac\b/.test(title)) return true;
  if (/\bhand\s?bags?\b|\btote bag\b|\bshoulder bag\b/.test(title)) return true;
  return false;
}

function fromEvidenceText(text: string): PrimaryFootwearCategory | null {
  if (/mocassi[mn]/.test(text)) return "LOAFER";
  if (/\bsandals?\b|sand[aá]lias?/.test(text)) return "SANDAL";
  if (/\bbotas?\b|\bbottes?\b|\bbottines?\b|\bboot(?:s|ies?)?\b|\bwell(?:y|ies)\b|\bwellingtons?\b/.test(text)) {
    return "BOOT";
  }
  if (/sapatilhas?/.test(text) && /t[eé]nis|sneaker|trainer/.test(text)) return "SNEAKER";
  if (/sapatilhas?/.test(text)) return "BALLET_FLAT";
  if (/\bmary[\s-]?janes?\b/.test(text)) return "BALLET_FLAT";
  if (/\bbelgians?\b/.test(text)) return "LOAFER";
  if (/\bsneakers?\b|\btrainers?\b/.test(text) && /\bballerinas?\b/.test(text)) return "SNEAKER";
  if (/\bballerinas?\b|\bbabies\b/.test(text)) return "BALLET_FLAT";
  if (/\bboat[\s-]shoes?\b|\bmoccasins?\b/.test(text)) return "LOAFER";
  if (/\bloafers?\b/.test(text)) return "LOAFER";
  if (/\btennis\b/.test(text)) return "SNEAKER";
  if (/\bslippers?\s+(?:[5-9]\d|1[0-4]\d)\b/.test(text)) return "MULE";
  if (/\bslippers?\b/.test(text) && /stiletto|block heel|\d+\s*mm|\bopen[\s-]toe\b/.test(text)) return "MULE";
  if (/\bmules?\b/.test(text)) return "MULE";
  if (/\bslingbacks?\b|\bslings?\b/.test(text)) return "PUMP";
  if (/stiletto|\bsabrina\b|\bsalto\b/.test(text)) return "PUMP";
  if (/sola baixa/.test(text)) {
    return /pala|fivela|met[aá]lico/.test(text) ? "LOAFER" : "BALLET_FLAT";
  }
  if (/detalhe cl[aá]ssico na parte superior/.test(text)) return "LOAFER";
  if (/\bslip[\s-]?ons?\b/.test(text)) return "LOAFER";
  if (/\bpumps?\b/.test(text)) return "PUMP";
  if (/\bflats?\b/.test(text)) return "BALLET_FLAT";
  if (/\bespadrilles?\b|\bjute sole\b/.test(text)) return "ESPADRILLE";
  if (/\blaces?\b/.test(text) && !/\bslippers?\b/.test(text)) return "BALLET_FLAT";
  if (/\bslippers?\b/.test(text)) return "LOAFER";
  return null;
}

/**
 * Official store product types and description evidence mapped onto the
 * existing short footwear categories. Generic words such as "sapato" are
 * used only after silhouette evidence is checked, so flats and loafers are
 * not left as Diğer.
 */
export function classifyOfficialFootwear(input: {
  title?: string | null;
  productType?: string | null;
  description?: string | null;
  tags?: string | null;
}): PrimaryFootwearCategory | null {
  const copy = fromEvidenceText(`${input.title ?? ""} ${input.description ?? ""}`.toLowerCase());
  if (copy) return copy;

  const mapped = PRODUCT_TYPE_PRIMARY[normalizeType(input.productType)];
  if (mapped) return mapped;
  const productType = normalizeType(input.productType);
  if (productType === "sapato" || productType === "sapatos") return "PUMP";

  const tags = (input.tags ?? "").toLowerCase();
  if (!tags) return null;
  return fromEvidenceText(tags);
}

export function legacyCategoryForPrimary(primary: PrimaryFootwearCategory): FootwearCategory {
  switch (primary) {
    case "BOOT":
      return "BOOT";
    case "SNEAKER":
      return "SNEAKER";
    case "SANDAL":
      return "SANDAL";
    case "MULE":
      return "MULE";
    case "LOAFER":
      return "LOAFER";
    case "PUMP":
      return "PUMP";
    case "BALLET_FLAT":
      return "BALLERINA";
    default:
      return "OTHER_FOOTWEAR";
  }
}
