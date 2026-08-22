import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { PilotProduct } from "../src/collector/types";
import type { ModelFamily } from "../src/modelFamily/types";
import { loadBrandRegistry } from "../src/registry/data/index";
import { filterFamiliesForBrandOfficial } from "../src/source/sourceProductQuery";
import {
  brandNeedsCategoryRecrawl,
  buildBrandCategoryCoverage,
} from "../src/source/categoryCompleteness";
import { brandNeedsImageRecrawl, buildBrandImageCoverage } from "../src/source/imageCompleteness";
import { buildVisualOtherAudit } from "../src/visual/digerAudit";
import {
  resolveVisualBasicCategory,
  VISUAL_BASIC_CATEGORIES,
} from "../src/visual/basicCategories";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  const products = await readJson<PilotProduct[]>(
    join(ROOT, "data", "multibrand", "products.json"),
    [],
  );
  const families = await readJson<ModelFamily[]>(
    join(ROOT, "data", "multibrand", "model-families.json"),
    [],
  );
  const registry = loadBrandRegistry();
  const productsByBrand = new Map<string, PilotProduct[]>();
  for (const product of products) {
    const key = product.brand.trim().toUpperCase();
    const list = productsByBrand.get(key) ?? [];
    list.push(product);
    productsByBrand.set(key, list);
  }

  const categoryEntries = [];
  const imageEntries = [];
  for (const brand of registry.all().filter((entry) => entry.isActive)) {
    const brandProducts = productsByBrand.get(brand.brand.trim().toUpperCase()) ?? [];
    const brandFamilies = filterFamiliesForBrandOfficial(families, brand.brand);
    const crawled = [
      ...(brand.footwearCollectionUrls ?? []),
      ...(brand.collectionPaths ?? []).map(
        (path) => `${(brand.officialUrl ?? "").replace(/\/$/, "")}${path}`,
      ),
    ].filter(Boolean);
    const category = buildBrandCategoryCoverage({
      brandId: brand.id,
      brandName: brand.brand,
      products: brandProducts,
      families: brandFamilies,
      crawledCollectionUrls: crawled,
      discoveredCollectionUrls: crawled,
    });
    categoryEntries.push({
      ...category,
      needsRecrawl: brandNeedsCategoryRecrawl(category),
    });
    imageEntries.push({
      ...buildBrandImageCoverage({
        brandId: brand.id,
        brandName: brand.brand,
        products: brandProducts,
        families: brandFamilies,
      }),
    });
  }

  for (const image of imageEntries) {
    (image as { needsRecrawl?: boolean }).needsRecrawl = brandNeedsImageRecrawl(image);
  }

  const visualBefore = Object.fromEntries(
    VISUAL_BASIC_CATEGORIES.map((item) => [
      item.id,
      item.id === "tumu"
        ? families.length
        : families.filter((family) => resolveVisualBasicCategory(family) === item.id).length,
    ]),
  );
  const digerAudit = buildVisualOtherAudit(families);

  const categoryReport = {
    generatedAt: new Date().toISOString(),
    brands: categoryEntries,
  };
  const imageReport = {
    generatedAt: new Date().toISOString(),
    brands: imageEntries,
  };

  await mkdir(join(ROOT, "data", "registry"), { recursive: true });
  await writeFile(
    join(ROOT, "data", "registry", "source-category-coverage-report.json"),
    JSON.stringify(categoryReport, null, 2),
    "utf-8",
  );
  await writeFile(
    join(ROOT, "data", "registry", "product-image-coverage-report.json"),
    JSON.stringify(imageReport, null, 2),
    "utf-8",
  );
  await writeFile(
    join(ROOT, "data", "registry", "visual-other-audit.json"),
    JSON.stringify({ ...digerAudit, visualCounts: visualBefore }, null, 2),
    "utf-8",
  );

  console.log("=== Source category coverage ===");
  for (const entry of categoryEntries) {
    console.log(
      `${entry.brandName}: families=${entry.modelFamilyCount} products=${entry.sourceProductCount} cats=${entry.sourceFootwearCategoryCount} coverage=${entry.categoryCoveragePercent}% genericOnly=${entry.productsOnlyGenericCategory} recrawl=${entry.needsRecrawl}`,
    );
    console.log(
      `  categories: ${entry.categories.slice(0, 8).map((item) => `${item.categoryName} (${item.productCount})`).join(" | ") || "(none)"}`,
    );
  }
  console.log("\n=== Image coverage ===");
  for (const entry of imageEntries) {
    console.log(
      `${entry.brandName}: n=${entry.products} 1img=${entry.productsWith1Image} 2+=${entry.productsWith2PlusImages} 3+=${entry.productsWith3PlusImages} avg=${entry.averageUniqueImages} collectorAvg=${entry.collectorAverage}`,
    );
  }
  console.log("\n=== VISUAL DİĞER ===");
  console.log(digerAudit.reasonCounts);
  console.log("top unmapped:", digerAudit.topUnmappedSourceCategories.slice(0, 15));
  console.log("visual counts:", visualBefore);
}

main();
