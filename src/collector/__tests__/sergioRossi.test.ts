import { describe, expect, it } from "vitest";

import type { OnboardingHttp } from "../../onboarding/http";
import { evaluateOfficialSourceCoverage } from "../../onboarding/validate";
import {
  collectSergioRossi,
  parseSergioRossiStorefrontCount,
  SERGIO_ROSSI_COLLECTIONS,
  SERGIO_ROSSI_WOMENS_SHOES_PATH,
} from "../sergioRossi";

const origin = "https://www.sergiorossi.com";
const config = {
  id: "sergio-rossi",
  brand: "SERGIO ROSSI",
  baseUrl: origin,
  collectionPaths: [SERGIO_ROSSI_WOMENS_SHOES_PATH],
  maxProducts: 250,
};

function transport(options: {
  mismatchPath?: string;
  missingGalleryPath?: string;
  missingRootPath?: string;
  repeatedPath?: string;
} = {}): OnboardingHttp {
  const productByPath = new Map(
    SERGIO_ROSSI_COLLECTIONS.map((category, index) => [
      category.path,
      {
        id: index + 1,
        handle: `opaque-model-${index + 1}`,
        title: `Opaque Model ${index + 1}`,
        product_type: "Shoes",
        tags: ["Shoes"],
        images: options.missingGalleryPath === category.path
          ? []
          : [
              { src: `${origin}/images/${index + 1}-1.jpg` },
              { src: `${origin}/images/${index + 1}-2.jpg` },
            ],
        variants: [{ title: "38", sku: `SR-${index + 1}-38` }],
      },
    ]),
  );

  return {
    async fetchText(url) {
      const parsed = new URL(url);
      const normalizedPath = parsed.pathname.replace(/^\/en-us(?=\/collections\/)/, "");
      if (normalizedPath === SERGIO_ROSSI_WOMENS_SHOES_PATH) {
        const links = SERGIO_ROSSI_COLLECTIONS
          .filter((category) => category.path !== options.missingRootPath)
          .map((category) => `<a href="${category.path}">${category.label}</a>`)
          .join("");
        return { ok: true, status: 200, url: `${origin}/en-us${SERGIO_ROSSI_WOMENS_SHOES_PATH}`, text: links };
      }

      const category = SERGIO_ROSSI_COLLECTIONS.find((item) =>
        normalizedPath === item.path || normalizedPath === `${item.path}/products.json`,
      );
      if (!category) return { ok: false, status: 404, url, text: "" };

      if (normalizedPath === category.path) {
        const count = options.repeatedPath === category.path ? 250 : options.mismatchPath === category.path ? 2 : 1;
        return {
          ok: true,
          status: 200,
          url: `${origin}/en-us${category.path}`,
          text: `<div class="product-count">${count} items</div>`,
        };
      }

      const page = Number(parsed.searchParams.get("page")) || 1;
      const product = productByPath.get(category.path)!;
      const repeatedBatch = Array.from({ length: 250 }, (_, offset) => ({
        ...product,
        id: 10_000 + offset,
        handle: `${product.handle}-${offset}`,
        title: `${product.title} ${offset}`,
      }));
      const products = options.repeatedPath === category.path
        ? repeatedBatch
        : page === 1
          ? [product]
          : [];
      return {
        ok: true,
        status: 200,
        url: `${origin}/en-us${category.path}/products.json?limit=250&page=${page}`,
        text: JSON.stringify({ products }),
      };
    },
  };
}

describe("Sergio Rossi customer-visible women's category reconciliation", () => {
  it("parses the customer-visible item count", () => {
    expect(parseSergioRossiStorefrontCount("<div>27 items</div>")).toBe(27);
    expect(parseSergioRossiStorefrontCount("<div>27 items</div><div>12 items</div>")).toBeNull();
    expect(parseSergioRossiStorefrontCount("<span data-items-counter>27</span> items")).toBe(27);
    expect(parseSergioRossiStorefrontCount("<span data-items-counter>27</span><span data-items-counter>12</span>")).toBeNull();
  });

  it("proves opaque models through exact official footwear category membership", async () => {
    const result = await collectSergioRossi(config, transport());
    expect(result.errors).toEqual([]);
    expect(result.products).toHaveLength(SERGIO_ROSSI_COLLECTIONS.length);
    expect(result.sourceReportedProductCount).toBe(SERGIO_ROSSI_COLLECTIONS.length);
    expect(result.rawProductUrlsDiscovered).toBe(SERGIO_ROSSI_COLLECTIONS.length);
    expect(result.paginationExhausted).toBe(true);
    expect(result.products.map((product) => product.category)).toEqual(
      SERGIO_ROSSI_COLLECTIONS.map((category) => category.category),
    );
    expect(result.products.every((product) => (product.images?.length ?? 0) === 2)).toBe(true);
    expect(
      evaluateOfficialSourceCoverage({
        ...result,
        acceptedProductCount: result.products.length,
      }).full,
    ).toBe(true);
  });

  it("fails closed when a storefront count, category link, gallery, or pagination is incomplete", async () => {
    for (const http of [
      transport({ mismatchPath: SERGIO_ROSSI_COLLECTIONS[0]!.path }),
      transport({ missingRootPath: SERGIO_ROSSI_COLLECTIONS[1]!.path }),
      transport({ missingGalleryPath: SERGIO_ROSSI_COLLECTIONS[2]!.path }),
      transport({ repeatedPath: SERGIO_ROSSI_COLLECTIONS[3]!.path }),
    ]) {
      const result = await collectSergioRossi(config, http);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        evaluateOfficialSourceCoverage({
          ...result,
          acceptedProductCount: result.products.length,
        }).full,
      ).toBe(false);
    }
  });

  it("refuses non-official hosts", async () => {
    await expect(
      collectSergioRossi({ ...config, baseUrl: "https://example.com" }, transport()),
    ).rejects.toThrow("official HTTPS storefront");
  });
});
