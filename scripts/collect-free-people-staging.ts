import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { collectFreePeopleWithBrowser } from "../src/collector/freePeopleBrowser";
import { FREE_PEOPLE_ID, FREE_PEOPLE_SHOES_URL } from "../src/collector/freePeople";
import type { PilotProduct } from "../src/collector/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_DIR = join(ROOT, "data", "onboarding", "staging", "free-people");
const PRODUCTS_FILE = join(ROOT, "data", "multibrand", "products.json");

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function brandCounts(products: PilotProduct[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const product of products) {
    counts[product.brand] = (counts[product.brand] ?? 0) + 1;
  }
  return counts;
}

function styleIdentity(product: PilotProduct): string {
  const sku = product.variants?.[0]?.sku || "";
  const skuMatch = String(sku).match(/^(\d{6,})/);
  if (skuMatch) return `free-people:${skuMatch[1]}`;
  const img = [product.imageUrl, ...(product.images ?? [])].filter(Boolean).join(" ");
  const imageMatch = img.match(/FreePeople\/(\d{6,})_/i);
  if (imageMatch) return `free-people:${imageMatch[1]}`;
  try {
    const url = new URL(product.productUrl);
    return `url:${url.origin}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return `url:${product.productUrl}`;
  }
}

function colorSourceOf(product: PilotProduct): string {
  const match = product.details?.match(/colorSource=([a-z-]+)/i);
  return match?.[1] ?? (product.color && String(product.color).trim() ? "unknown" : "none");
}

function isColorName(color: string | null | undefined): boolean {
  const value = (color ?? "").trim();
  if (!value) return false;
  return !/^\d{2,3}$/.test(value);
}

async function main() {
  const beforeCatalog = await readFile(PRODUCTS_FILE);
  const beforeHash = sha256(beforeCatalog);
  const beforeProducts = JSON.parse(beforeCatalog.toString("utf-8")) as PilotProduct[];
  const beforeOfficial = beforeProducts.filter(
    (product) => product.source !== "farfetch" && product.source !== "level-shoes",
  );
  const beforeOfficialBrands = new Set(beforeOfficial.map((product) => product.brand));

  console.log("=== CAPONE Free People staging collect ===");
  console.log(`Production products.json sha256 before: ${beforeHash}`);
  console.log(`Catalog: ${FREE_PEOPLE_SHOES_URL}`);

  const result = await collectFreePeopleWithBrowser({ headless: true });

  const counts = brandCounts(result.products);
  const topBrands = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([brand, productCount]) => ({ brand, productCount }));
  const withImages = result.products.filter(
    (product) => (product.images?.length ?? 0) > 0 || product.imageUrl,
  ).length;
  const withPrice = result.products.filter(
    (product) => product.details && /price=/.test(product.details),
  ).length;
  const withColor = result.products.filter(
    (product) => product.color && String(product.color).trim(),
  );
  const emptyColor = result.products.length - withColor.length;
  const colorPercent =
    result.products.length === 0
      ? 0
      : Math.round((withColor.length / result.products.length) * 10000) / 100;
  const colorNames = withColor.filter((product) => isColorName(product.color)).length;
  const colorCodesOnly = withColor.length - colorNames;
  const byColorSource: Record<string, number> = {};
  for (const product of result.products) {
    const source = colorSourceOf(product);
    byColorSource[source] = (byColorSource[source] ?? 0) + 1;
  }

  const colorSamples = result.products
    .filter((product) => product.color && String(product.color).trim())
    .slice(0, 20)
    .map((product) => ({
      brand: product.brand,
      productName: product.productName,
      styleNumber: styleIdentity(product).replace(/^free-people:/, ""),
      color: product.color,
      colorSource: colorSourceOf(product),
      productUrl: product.productUrl,
    }));

  const ugg = result.products.filter((product) => /ugg/i.test(product.brand)).slice(0, 5);
  const birkenstock = result.products
    .filter((product) => /birkenstock/i.test(product.brand))
    .slice(0, 5);
  const house = result.products
    .filter((product) => /we the free|fp collection|fp vegan|free people/i.test(product.brand))
    .slice(0, 8);

  const report = {
    generatedAt: new Date().toISOString(),
    source: FREE_PEOPLE_ID,
    catalogUrl: FREE_PEOPLE_SHOES_URL,
    status: result.status,
    totalProducts: result.products.length,
    uniqueBrands: Object.keys(counts).length,
    topBrands,
    brandCounts: counts,
    footwearNonFootwearRejectionCount: result.stats.nonFootwearRejected,
    editorialSkipped: result.stats.editorialSkipped,
    duplicateCount: result.stats.duplicateCount,
    tilesSeen: result.stats.tilesSeen,
    pagesVisited: result.pagesVisited,
    paginationExhausted: result.paginationExhausted,
    sourceReportedProductCount: result.sourceReportedProductCount,
    colorCoverage: {
      nonEmpty: withColor.length,
      empty: emptyColor,
      percent: colorPercent,
      nameCount: colorNames,
      codeOnlyCount: colorCodesOnly,
      bySource: byColorSource,
      parserStats: {
        colorFromPiniaSlice: result.stats.colorFromPiniaSlice,
        colorFromImageCode: result.stats.colorFromImageCode,
        colorFromUrlQuery: result.stats.colorFromUrlQuery,
        colorEmpty: result.stats.colorEmpty,
      },
      samples: colorSamples,
    },
    imageCoverage: {
      productsWithImages: withImages,
      percent:
        result.products.length === 0
          ? 0
          : Math.round((withImages / result.products.length) * 1000) / 10,
    },
    priceCoverage: {
      productsWithPrice: withPrice,
      percent:
        result.products.length === 0
          ? 0
          : Math.round((withPrice / result.products.length) * 1000) / 10,
    },
    examples: {
      ugg: ugg.map((product) => ({
        brand: product.brand,
        productName: product.productName,
        productUrl: product.productUrl,
        color: product.color,
      })),
      birkenstock: birkenstock.map((product) => ({
        brand: product.brand,
        productName: product.productName,
        productUrl: product.productUrl,
        color: product.color,
      })),
      houseLabels: house.map((product) => ({
        brand: product.brand,
        productName: product.productName,
        productUrl: product.productUrl,
        color: product.color,
      })),
    },
    errors: result.errors,
    productionGuard: {
      productsJsonSha256Before: beforeHash,
      officialBrandCountBefore: beforeOfficialBrands.size,
    },
  };

  await mkdir(STAGING_DIR, { recursive: true });
  await writeFile(join(STAGING_DIR, "products.json"), JSON.stringify(result.products, null, 2), "utf-8");
  await writeFile(join(STAGING_DIR, "report.json"), JSON.stringify(report, null, 2), "utf-8");

  const afterCatalog = await readFile(PRODUCTS_FILE);
  const afterHash = sha256(afterCatalog);
  const afterProducts = JSON.parse(afterCatalog.toString("utf-8")) as PilotProduct[];
  const afterOfficial = afterProducts.filter(
    (product) => product.source !== "farfetch" && product.source !== "level-shoes",
  );
  const afterOfficialBrands = new Set(afterOfficial.map((product) => product.brand));

  const guard = {
    productsJsonUnchanged: beforeHash === afterHash,
    productsJsonSha256After: afterHash,
    officialProductCountBefore: beforeOfficial.length,
    officialProductCountAfter: afterOfficial.length,
    officialBrandCountBefore: beforeOfficialBrands.size,
    officialBrandCountAfter: afterOfficialBrands.size,
  };
  await writeFile(
    join(STAGING_DIR, "production-guard.json"),
    JSON.stringify({ ...report.productionGuard, ...guard }, null, 2),
    "utf-8",
  );

  console.log(JSON.stringify({ ...report, productionGuard: { ...report.productionGuard, ...guard } }, null, 2));
  console.log(`Staging products: ${join(STAGING_DIR, "products.json")}`);
  if (!guard.productsJsonUnchanged) {
    throw new Error("Production data/multibrand/products.json changed during staging collect");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
