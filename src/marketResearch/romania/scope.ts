export const ROMANIA_SALES_MARKET = "RO";
export const ROMANIA_MARKET_ID = "romania";
export const ROMANIA_MARKET_LABEL = "Romanya";

export const ROMANIA_ORIGIN_BRAND_IDS = [
  "mr-ro-il-passo",
  "mr-ro-musette",
  "mr-ro-epica",
  "mr-ro-marelbo",
  "mr-ro-papucei",
  "mr-ro-mihaela-glavan",
  "mr-ro-gryxx",
] as const;

export const POLISH_SOLD_IN_ROMANIA_BRAND_IDS = [
  "mr-ro-wojas",
  "mr-ro-badura",
  "mr-ro-gino-rossi",
  "mr-ro-lasocki",
] as const;

export const ADDITIONAL_ROMANIA_BRAND_IDS = [
  "mr-ro-aldo",
  "mr-ro-botta",
  "mr-ro-flavia-passini",
] as const;

export const ROMANIA_VISIBLE_BRAND_IDS = [
  ...ROMANIA_ORIGIN_BRAND_IDS,
  ...POLISH_SOLD_IN_ROMANIA_BRAND_IDS,
  ...ADDITIONAL_ROMANIA_BRAND_IDS,
] as const;

export const ROMANIA_HIDDEN_OR_EXCLUDED = {
  "anna-cori": "Anna Cori erişilebilir veri yok — kart gösterilmez",
  otter: "OTTER retailer/source; marka kartı değil",
  benvenuti: "İlk kapsamda marka kartı değil",
  "enzo-bertini": "İlk kapsamda marka kartı değil",
  exe: "EXÉ Portekiz markasıdır; Yunan olarak sınıflandırılır, Romanya görünümüne eklenmez",
  "tsakiris-mallas": "Yunan markası; Romanya görünümüne eklenmez",
  sante: "Yunan markası; Romanya görünümüne eklenmez",
} as const;

export function isRomaniaVisibleBrandId(id: string): boolean {
  return (ROMANIA_VISIBLE_BRAND_IDS as readonly string[]).includes(id);
}
