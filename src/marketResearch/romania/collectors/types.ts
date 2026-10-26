import type { MarketResearchMappedCategoryId } from "../../types";

export type RomaniaCollectorStatus = "ok" | "partial" | "source_unavailable";

export interface RomaniaCollectedProduct {
  source_product_id: string;
  model_key: string;
  name: string;
  color: string | null;
  category_id: MarketResearchMappedCategoryId;
  product_url: string;
  images: string[];
  current_price: number | null;
  list_price: number | null;
  currency: string;
  observed_at: string;
}

export interface RomaniaSourceCoverageReport {
  source_id: string;
  source_name: string;
  status: RomaniaCollectorStatus;
  source_total: number | null;
  collected: number;
  unique_models: number;
  missing: number | null;
  coverage_percent: number | null;
  gallery_coverage_percent: number | null;
  price_coverage_percent: number | null;
  source_unavailable: boolean;
  pagination_complete: boolean;
  last_attempt_at: string;
  last_success_at: string | null;
  note: string | null;
}

export interface RomaniaSourceStagingResult {
  version: 1;
  kind: "romania-source-staging";
  source: {
    id: string;
    name: string;
    sales_market: "RO";
    entity_kind: "brand" | "retailer" | "marketplace";
    category_url: string;
  };
  coverage: RomaniaSourceCoverageReport;
  products: RomaniaCollectedProduct[];
  failed_product_urls: string[];
  publishable: boolean;
}

export type FetchHtml = (url: string) => Promise<string>;
