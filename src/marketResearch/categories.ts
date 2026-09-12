import type {
  MarketResearchCategoryId,
  MarketResearchCategoryOption,
  MarketResearchMappedCategoryId,
  MarketResearchModel,
} from "./types";

/** Classic CAPONE category presentation — independent of Visual/catalog types. */
export const MARKET_RESEARCH_CATEGORIES: readonly MarketResearchCategoryOption[] = [
  { id: "tumu", label: "TÜMÜ" },
  { id: "babet", label: "BABET" },
  { id: "loafer", label: "LOAFER" },
  { id: "topuklu", label: "TOPUKLU" },
  { id: "sandal", label: "SANDAL" },
  { id: "mule", label: "MULE" },
  { id: "bot-cizme", label: "BOT / ÇİZME" },
  { id: "sneaker", label: "SNEAKER" },
  { id: "espadril", label: "ESPADRİL" },
  { id: "oxford-derby", label: "OXFORD / DERBY" },
  { id: "clog", label: "CLOG" },
  { id: "diger", label: "DİĞER" },
];

export function marketResearchCategoryLabel(id: MarketResearchCategoryId): string {
  return MARKET_RESEARCH_CATEGORIES.find((item) => item.id === id)?.label ?? id;
}

export interface MarketResearchCategoryCount {
  id: MarketResearchCategoryId;
  label: string;
  count: number;
}

export function countModelsByCategory(models: MarketResearchModel[]): MarketResearchCategoryCount[] {
  const counts = new Map<MarketResearchMappedCategoryId, number>();
  for (const model of models) {
    counts.set(model.categoryId, (counts.get(model.categoryId) ?? 0) + 1);
  }
  return MARKET_RESEARCH_CATEGORIES.map((item) => ({
    id: item.id,
    label: item.label,
    count: item.id === "tumu" ? models.length : (counts.get(item.id as MarketResearchMappedCategoryId) ?? 0),
  })).filter((item) => item.id === "tumu" || item.count > 0);
}

export function filterModelsByCategory(
  models: MarketResearchModel[],
  categoryId: string | null,
): MarketResearchModel[] {
  if (!categoryId || categoryId === "tumu") return models;
  return models.filter((model) => model.categoryId === categoryId);
}
