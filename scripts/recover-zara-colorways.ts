import { readFile, writeFile, unlink, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchText } from "../src/collector/http";
import { mergeProductCatalog } from "../src/collector/mergeProducts";
import {
  extractZaraCommercialComponents,
  zaraComponentToProduct,
  type ZaraCategoryNode,
} from "../src/collector/zara";
import type { PilotProduct } from "../src/collector/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_PATH = join(ROOT, "data", "multibrand", "products.json");
const ANALYZED_PATH = join(ROOT, "data", "multibrand", "analyzed-products.json");
const LISTING_URL = "https://www.zara.com/us/en/category/2419160/products?ajax=true";

const VIEW_ALL: ZaraCategoryNode = {
  id: 2419160,
  name: "VIEW ALL",
  seoKeyword: "woman-shoes",
  seoCategoryId: 1251,
  path: ["WOMAN", "SHOES", "VIEW ALL"],
  subcategories: [],
};

async function writeWithRetry(path: string, body: string): Promise<void> {
  const tmp = `${path}.${process.pid}.tmp`;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await writeFile(tmp, body, "utf-8");
      try {
        await unlink(path);
      } catch {
        // ignore missing destination
      }
      await rename(tmp, path);
      return;
    } catch (error) {
      console.warn(`retry ${attempt + 1} ${path}: ${error instanceof Error ? error.message : error}`);
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  await writeFile(path, body, "utf-8");
}

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, "").toLowerCase();
}

function uniqueColorCount(product: { color?: string | null; variants?: Array<{ color?: string | null }> }): number {
  const colors = new Set<string>();
  if (product.color?.trim()) colors.add(product.color.trim().toLowerCase());
  for (const variant of product.variants ?? []) {
    if (variant.color?.trim()) colors.add(variant.color.trim().toLowerCase());
  }
  return colors.size;
}

const listing = await fetchText(LISTING_URL, {
  delayMs: 200,
  headers: {
    Accept: "application/json",
    Referer: "https://www.zara.com/us/en/",
    "X-Requested-With": "XMLHttpRequest",
  },
});
if (!listing.ok || !listing.text.trim().startsWith("{")) {
  throw new Error(`Zara listing fetch failed: ${listing.error ?? listing.status}`);
}

const components = extractZaraCommercialComponents(JSON.parse(listing.text));
const discoveredAt = new Date().toISOString();
const liveProducts = mergeProductCatalog(
  [],
  components
    .map((component) => zaraComponentToProduct(component, VIEW_ALL, discoveredAt))
    .filter((item): item is PilotProduct => Boolean(item)),
);
const liveByUrl = new Map(liveProducts.map((product) => [normalizeUrl(product.productUrl), product]));

const products = JSON.parse(await readFile(PRODUCTS_PATH, "utf-8")) as PilotProduct[];
let patchedProducts = 0;
let recoveredColors = 0;

for (const product of products) {
  if (product.source.trim().toLowerCase() !== "zara") continue;
  const live = liveByUrl.get(normalizeUrl(product.productUrl));
  if (!live) continue;
  const before = uniqueColorCount(product);
  const merged = mergeProductCatalog([product], [live])[0]!;
  const after = uniqueColorCount(merged);
  const preserved = {
    discoveredAt: product.discoveredAt,
    publishedAt: product.publishedAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
  Object.assign(product, merged, preserved);
  patchedProducts += 1;
  recoveredColors += Math.max(0, after - before);
}

await writeWithRetry(PRODUCTS_PATH, JSON.stringify(products));

const analyzed = JSON.parse(await readFile(ANALYZED_PATH, "utf-8")) as Array<
  PilotProduct & { cleaned?: { color: string | null; heelHeight: string | null } }
>;
let patchedAnalyzed = 0;
for (const product of analyzed) {
  if (product.source.trim().toLowerCase() !== "zara") continue;
  const live = liveByUrl.get(normalizeUrl(product.productUrl));
  if (!live) continue;
  const merged = mergeProductCatalog([product], [live])[0]!;
  product.color = merged.color;
  product.imageUrl = merged.imageUrl;
  product.images = merged.images;
  product.variants = merged.variants;
  if (product.cleaned) {
    product.cleaned = { ...product.cleaned, color: merged.color ?? product.cleaned.color };
  }
  patchedAnalyzed += 1;
}

await writeWithRetry(ANALYZED_PATH, JSON.stringify(analyzed));

const multiColorLive = liveProducts.filter((product) => uniqueColorCount(product) > 1);
console.log(
  JSON.stringify(
    {
      liveProducts: liveProducts.length,
      liveMultiColor: multiColorLive.length,
      patchedProducts,
      patchedAnalyzed,
      recoveredColors,
      examples: multiColorLive.slice(0, 12).map((product) => ({
        url: product.productUrl,
        name: product.productName,
        colors: [...new Set((product.variants ?? []).map((variant) => variant.color).filter(Boolean))],
        style: product.variants?.find((variant) => variant.sku)?.sku ?? null,
      })),
    },
    null,
    2,
  ),
);
