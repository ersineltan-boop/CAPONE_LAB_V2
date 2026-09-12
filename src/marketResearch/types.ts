export const MARKET_RESEARCH_ENTITY_KINDS = [
  "brand",
  "retailer",
  "marketplace",
] as const;

export type MarketResearchEntityKind = (typeof MARKET_RESEARCH_ENTITY_KINDS)[number];

export const MARKET_RESEARCH_CATEGORY_IDS = [
  "tumu",
  "babet",
  "loafer",
  "topuklu",
  "sandal",
  "mule",
  "bot-cizme",
  "sneaker",
  "espadril",
  "oxford-derby",
  "clog",
  "diger",
] as const;

export type MarketResearchCategoryId = (typeof MARKET_RESEARCH_CATEGORY_IDS)[number];

export type MarketResearchMappedCategoryId = Exclude<MarketResearchCategoryId, "tumu">;

export interface MarketResearchCategoryOption {
  id: MarketResearchCategoryId;
  label: string;
}

export type MarketResearchSourceKind = "brand" | "retailer" | "marketplace";

export interface MarketResearchSourceLink {
  label: string;
  url: string;
  kind: MarketResearchSourceKind;
}

export interface MarketResearchPriceObservation {
  currentPrice: number | null;
  listPrice: number | null;
  currency: string;
  discountPercent: number | null;
  observedAt: string;
}

export interface MarketResearchVariant extends MarketResearchPriceObservation {
  id: string;
  color: string | null;
  productUrl: string;
  images: string[];
}

export interface MarketResearchModel {
  id: string;
  name: string;
  categoryId: MarketResearchMappedCategoryId;
  categoryLabel: string;
  variants: MarketResearchVariant[];
}

export interface MarketResearchBrand {
  id: string;
  name: string;
  entityKind: "brand";
  originCountry: string;
  originCountryLabel: string;
  salesMarket: string;
  markets: string[];
  soldInSalesMarket: boolean;
  availability: "visible";
  sourceLinks: MarketResearchSourceLink[];
  models: MarketResearchModel[];
}

export interface MarketResearchRetailer {
  id: string;
  name: string;
  entityKind: "retailer" | "marketplace";
  showAsBrandCard: false;
  role: "evidence_source";
  url: string;
}

export interface MarketResearchExclusion {
  id: string;
  name: string;
  reason: string;
}

export interface MarketResearchCountryCatalog {
  version: 1;
  kind: "market-research-snapshot";
  salesMarket: string;
  salesMarketLabel: string;
  observedAt: string;
  snapshotNote: string;
  brands: MarketResearchBrand[];
  retailers: MarketResearchRetailer[];
  excluded: MarketResearchExclusion[];
}

export interface MarketResearchBrandCard {
  id: string;
  name: string;
  originCountry: string;
  originCountryLabel: string;
  salesMarket: string;
  salesMarketLabel: string;
  soldInSalesMarket: boolean;
  sourceLinks: MarketResearchSourceLink[];
  modelCount: number;
  images: string[];
}

export interface MarketResearchCountrySummary {
  id: string;
  label: string;
  salesMarket: string;
  observedAt: string;
  snapshotNote: string;
  brandCount: number;
}
