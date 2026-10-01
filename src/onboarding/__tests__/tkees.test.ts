import { describe, expect, it } from "vitest";

import { TKEES_FOOTWEAR_PATHS } from "../../collector/tkees";
import type { OnboardingHttp } from "../http";
import { probeBrandSource } from "../probe";

const origin = "https://www.tkees.com";

describe("TKEES official Shopify onboarding", () => {
  it("probes only the verified footwear roots instead of the mixed store-wide catalog", async () => {
    const requested: string[] = [];
    const shoe = {
      handle: "lily-nudes-cocobutter",
      title: "Lily Nudes Cocobutter",
      product_type: "Flip Flops",
      tags: ["Footwear", "Flip Flops"],
      images: [{ src: "https://cdn.example.com/lily.jpg" }],
      variants: [{ sku: "LILY-COCO-7", title: "7" }],
    };
    const http: OnboardingHttp = {
      async fetchText(url) {
        requested.push(url);
        if (url === origin) {
          return {
            ok: true,
            status: 200,
            url,
            text: "cdn.shopify.com Shopify.theme",
          };
        }
        if (
          TKEES_FOOTWEAR_PATHS.some((path) =>
            url.startsWith(`${origin}${path}/products.json`),
          )
        ) {
          return {
            ok: true,
            status: 200,
            url,
            text: JSON.stringify({ products: [shoe] }),
          };
        }
        return { ok: false, status: 404, text: "", url };
      },
    };

    const result = await probeBrandSource({
      slug: "tkees",
      brand: "TKEES",
      sourceUrl: origin,
      http,
    });

    expect(result.strategy).toBe("shopify-public");
    expect(result.footwearPaths).toEqual([...TKEES_FOOTWEAR_PATHS]);
    expect(result.products.length).toBeGreaterThan(0);
    expect(requested).not.toContain(`${origin}/products.json?limit=8`);
    for (const path of TKEES_FOOTWEAR_PATHS) {
      expect(requested.some((url) => url.startsWith(`${origin}${path}/products.json`))).toBe(true);
    }
  });
});
