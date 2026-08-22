import { describe, expect, it } from "vitest";

import { extractShopifyProductDates } from "../shopifyDates";
import { mergeProductDates, mergeProductDatesBatch } from "../merge";
import type { ProductDateEnrichmentSidecar } from "../types";

describe("extractShopifyProductDates", () => {
  it("maps Shopify snake_case fields when present", () => {
    expect(
      extractShopifyProductDates({
        published_at: "2024-06-01T12:00:00-04:00",
        created_at: "2024-05-15T08:30:00-04:00",
        updated_at: "2025-01-10T09:00:00-05:00",
      }),
    ).toEqual({
      publishedAt: "2024-06-01T12:00:00-04:00",
      createdAt: "2024-05-15T08:30:00-04:00",
      updatedAt: "2025-01-10T09:00:00-05:00",
    });
  });

  it("omits invalid or empty values", () => {
    expect(
      extractShopifyProductDates({
        published_at: "",
        created_at: "not-a-date",
      }),
    ).toEqual({});
  });
});

describe("mergeProductDates", () => {
  const sidecar: ProductDateEnrichmentSidecar = {
    "https://x/a": {
      publishedAt: "2024-01-01T00:00:00.000Z",
      createdAt: "2023-12-01T00:00:00.000Z",
      enrichedAt: "2026-08-19T00:00:00.000Z",
    },
  };

  it("fills missing dates from sidecar", () => {
    const merged = mergeProductDates(
      { productUrl: "https://x/a", publishedAt: null, createdAt: null },
      sidecar,
    );
    expect(merged.publishedAt).toBe("2024-01-01T00:00:00.000Z");
    expect(merged.createdAt).toBe("2023-12-01T00:00:00.000Z");
  });

  it("keeps collector dates over sidecar", () => {
    const merged = mergeProductDates(
      {
        productUrl: "https://x/a",
        publishedAt: "2025-06-01T00:00:00.000Z",
      },
      sidecar,
    );
    expect(merged.publishedAt).toBe("2025-06-01T00:00:00.000Z");
  });

  it("batch merges only when sidecar has entries", () => {
    const products = [
      { productUrl: "https://x/a", publishedAt: null as string | null },
      { productUrl: "https://x/b", publishedAt: null as string | null },
    ];
    const merged = mergeProductDatesBatch(products, sidecar);
    expect(merged[0]?.publishedAt).toBe("2024-01-01T00:00:00.000Z");
    expect(merged[1]?.publishedAt).toBeNull();
  });
});
