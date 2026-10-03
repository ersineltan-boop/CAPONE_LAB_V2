import { describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ malformed: false }));
vi.mock("../http", () => ({
  sleep: async () => {},
  fetchJson: async (url: string) => {
    if (url.includes("page=2")) return { ok: false, status: 503, data: null, error: "HTTP 503 second discovery page" };
    return { ok: true, status: 200, data: fixture.malformed ? {} : { collections: Array.from({ length: 250 }, (_, id) => ({ handle: `collection-${id}`, title: "Shoes", products_count: 1 })) } };
  },
}));
import { listShopifyCollections } from "../shopify";

describe("complete source NEW discovery", () => {
  it("propagates a later listing failure so prior NEW cannot be cleared using partial discovery", async () => {
    const result = await listShopifyCollections("https://source.test");
    expect(result.collections).toHaveLength(250);
    expect(result.errors).toEqual(["HTTP 503 second discovery page"]);
  });
  it("rejects a successful HTTP response whose collection payload is absent", async () => {
    fixture.malformed = true;
    try {
      const result = await listShopifyCollections("https://source.test");
      expect(result.collections).toEqual([]);
      expect(result.errors[0]).toContain("Invalid Shopify collections payload");
    } finally { fixture.malformed = false; }
  });
});
