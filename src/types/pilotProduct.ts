export type FootwearCategory =
  | "BOOT"
  | "ANKLE_BOOT"
  | "PUMP"
  | "SLINGBACK"
  | "BALLERINA"
  | "MARY_JANE"
  | "LOAFER"
  | "MULE"
  | "SANDAL"
  | "THONG"
  | "WEDGE"
  | "SNEAKER"
  | "OTHER_FOOTWEAR";

export interface PilotProduct {
  source: string;
  brand: string;
  productName: string;
  productUrl: string;
  imageUrl: string | null;
  category: FootwearCategory | null;
  color: string | null;
  material: string | null;
  toeShape: string | null;
  heelType: string | null;
  heelHeight: string | null;
  details: string | null;
  discoveredAt: string;
}

export type PilotBrandFilter = "Tümü" | "Schutz" | "Tony Bianco" | "St. Agni";

export const PILOT_BRAND_FILTERS: PilotBrandFilter[] = [
  "Tümü",
  "Schutz",
  "Tony Bianco",
  "St. Agni",
];

export const FOOTWEAR_CATEGORIES: FootwearCategory[] = [
  "BOOT",
  "ANKLE_BOOT",
  "PUMP",
  "SLINGBACK",
  "BALLERINA",
  "MARY_JANE",
  "LOAFER",
  "MULE",
  "SANDAL",
  "THONG",
  "WEDGE",
  "SNEAKER",
  "OTHER_FOOTWEAR",
];
