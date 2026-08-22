import { evaluateFootwearProduct } from "../collector/footwearGate";
import { extractJsonLdBlocks, mapSchemaProducts } from "../collector/schemaOrg";
import type { OnboardingHttp } from "./http";
import type { ProbeSampleProduct } from "./types";

const PRODUCT_LOC = /<loc>\s*([^<]+)\s*<\/loc>/gi;

export function parseSitemapLocs(xml: string): string[] {
  const urls: string[] = [];
  for (const match of xml.matchAll(PRODUCT_LOC)) {
    const loc = match[1]?.trim();
    if (loc) urls.push(loc);
  }
  return urls;
}

export function isProductUrl(url: string): boolean {
  return /\/products?\/|\/p\/|\/product\/|-p\d+\.html|\/buy\//i.test(url);
}

export function isFootwearSitemapUrl(url: string): boolean {
  return /shoe|footwear|heel|sandal|boot|pump|mule|loafer|sneaker|zapato|chaussure/i.test(url);
}

export async function discoverSitemapProductUrls(
  http: OnboardingHttp,
  baseUrl: string,
): Promise<string[]> {
  const origin = baseUrl.replace(/\/$/, "");
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap_products_1.xml`,
    `${origin}/product-sitemap.xml`,
    `${origin}/sitemap-products.xml`,
  ];
  const productUrls = new Set<string>();

  for (const sitemapUrl of candidates) {
    const result = await http.fetchText(sitemapUrl, { delayMs: 350 });
    if (!result.ok) continue;
    const locs = parseSitemapLocs(result.text);
    const nested = locs.filter((loc) => /sitemap/i.test(loc)).slice(0, 6);
    const direct = locs.filter((loc) => isProductUrl(loc) || isFootwearSitemapUrl(loc));
    for (const loc of direct) productUrls.add(loc);
    for (const child of nested) {
      const nestedResult = await http.fetchText(child, { delayMs: 350 });
      if (!nestedResult.ok) continue;
      for (const loc of parseSitemapLocs(nestedResult.text)) {
        if (isProductUrl(loc) || isFootwearSitemapUrl(loc)) productUrls.add(loc);
      }
      if (productUrls.size >= 40) break;
    }
    if (productUrls.size >= 24) break;
  }

  return [...productUrls].slice(0, 40);
}

export async function collectFromProductUrls(
  http: OnboardingHttp,
  productUrls: string[],
  brand: { id: string; name: string; baseUrl: string },
  limit = 24,
): Promise<ProbeSampleProduct[]> {
  const samples: ProbeSampleProduct[] = [];
  for (const productUrl of productUrls.slice(0, limit)) {
    const page = await http.fetchText(productUrl, { delayMs: 250 });
    if (!page.ok) continue;
    const blocks = extractJsonLdBlocks(page.text);
    if (blocks.length === 0) continue;
    const mapped = mapSchemaProducts(
      page.text,
      {
        id: brand.id,
        brand: brand.name,
        baseUrl: brand.baseUrl,
        collectionPaths: [],
        maxProducts: 4,
      },
      new Date().toISOString(),
      productUrl,
    );
    for (const product of mapped) {
      const gate = evaluateFootwearProduct({
        title: product.productName,
        productType: product.category ?? product.sourceCategoryName ?? "",
        handle: product.productUrl,
        collectionPath: product.collectionPath ?? "",
      });
      if (gate.decision !== "ACCEPT_FOOTWEAR") continue;
      samples.push({
        productUrl: product.productUrl,
        productName: product.productName,
        imageUrl: product.imageUrl,
        images: product.images ?? [],
        color: product.color,
        sku: product.variants.find((variant) => variant.sku)?.sku ?? null,
        sourceCategoryName: product.sourceCategoryName ?? null,
      });
    }
    if (samples.length >= 8) break;
  }
  return samples;
}
