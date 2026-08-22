import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchJson, sleep } from "../src/collector/http";
import { normalizeProductImageUrls } from "../src/modelFamily/productImages";
import type { RawAnalyzedProduct } from "../src/modelFamily/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MULTIBRAND_DIR = join(ROOT, "data", "multibrand");

interface ShopifyProductJson {
  product?: {
    images?: Array<{ src?: string | null }>;
  };
}

async function loadExistingGalleries(
  path: string,
): Promise<Record<string, string[]>> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {};
  }
}

const analyzedPath = join(MULTIBRAND_DIR, "analyzed-products.json");
const galleriesPath = join(MULTIBRAND_DIR, "product-image-galleries.json");

const products = JSON.parse(
  await readFile(analyzedPath, "utf-8"),
) as RawAnalyzedProduct[];

const existing = await loadExistingGalleries(galleriesPath);
const galleries: Record<string, string[]> = { ...existing };
const errors: string[] = [];

let fetched = 0;
let skipped = 0;

for (const product of products) {
  if (galleries[product.productUrl]?.length) {
    skipped += 1;
    continue;
  }

  const jsonUrl = `${product.productUrl.replace(/\/$/, "")}.json`;
  const result = await fetchJson<ShopifyProductJson>(jsonUrl, 700);

  if (result.ok && result.data?.product?.images?.length) {
    const urls = normalizeProductImageUrls(
      result.data.product.images.map((image) => image.src),
    );
    galleries[product.productUrl] =
      urls.length > 0
        ? urls
        : normalizeProductImageUrls([product.imageUrl]);
  } else {
    galleries[product.productUrl] = normalizeProductImageUrls([product.imageUrl]);
    if (!result.ok) {
      errors.push(result.error ?? `Failed ${jsonUrl}`);
    }
  }

  fetched += 1;
  await sleep(200);
}

await mkdir(MULTIBRAND_DIR, { recursive: true });
await writeFile(galleriesPath, JSON.stringify(galleries, null, 2), "utf-8");

const counts = Object.values(galleries).map((images) => images.length);
const multi = counts.filter((count) => count > 1).length;
const total = counts.reduce((sum, count) => sum + count, 0);

console.log("\n=== CAPONE LAB Product Image Galleries ===");
console.log(`Products processed this run: ${fetched}`);
console.log(`Products reused from cache: ${skipped}`);
console.log(`Products with >1 image: ${multi}`);
console.log(
  `Average images per product: ${
    counts.length > 0 ? Math.round((total / counts.length) * 100) / 100 : 0
  }`,
);
console.log(`Max images on a product: ${counts.length > 0 ? Math.max(...counts) : 0}`);
if (errors.length > 0) {
  console.log(`Fetch errors: ${errors.length}`);
}
