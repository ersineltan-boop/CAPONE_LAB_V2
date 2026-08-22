import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildModelFamilies } from "../src/modelFamily/buildModelFamilies";
import type { ModelFamily, RawAnalyzedProduct } from "../src/modelFamily/types";
import {
  getVisionEnrichmentMap,
} from "../src/taxonomy/vision/cache";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MULTIBRAND_DIR = join(ROOT, "data", "multibrand");

async function loadProductImageGalleries(): Promise<Record<string, string[]>> {
  try {
    const raw = await readFile(
      join(MULTIBRAND_DIR, "product-image-galleries.json"),
      "utf-8",
    );
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {};
  }
}

const analyzedPath = join(MULTIBRAND_DIR, "analyzed-products.json");
const raw = await readFile(analyzedPath, "utf-8");
const products = JSON.parse(raw) as RawAnalyzedProduct[];
const productImageGalleries = await loadProductImageGalleries();

let priorFamilies: ModelFamily[] = [];
try {
  priorFamilies = JSON.parse(
    await readFile(join(MULTIBRAND_DIR, "model-families.json"), "utf-8"),
  ) as ModelFamily[];
} catch {
  priorFamilies = [];
}

const visionCacheRaw = await readFile(
  join(MULTIBRAND_DIR, "taxonomy-vision-cache.json"),
  "utf-8",
).catch(() => null);
const visionEnrichments = getVisionEnrichmentMap(
  visionCacheRaw
    ? (JSON.parse(visionCacheRaw) as import("../src/taxonomy/vision/types").TaxonomyVisionCacheFile)
    : { version: 1, promptVersion: "taxonomy-v1-1", records: {} },
);

const { families, report } = buildModelFamilies(products, {
  productImageGalleries,
  priorFamilies,
  visionEnrichments,
});

await mkdir(MULTIBRAND_DIR, { recursive: true });

const familiesPath = join(MULTIBRAND_DIR, "model-families.json");
const reportPath = join(MULTIBRAND_DIR, "model-family-report.json");

await writeFile(familiesPath, JSON.stringify(families, null, 2), "utf-8");
await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");

console.log("\n=== CAPONE LAB Model Family Deduplication ===");
console.log(`Raw products: ${report.rawProductCount}`);
console.log(`Canonical models: ${report.modelFamilyCount}`);
console.log(
  `Duplicate/variant products collapsed: ${report.collapsedVariantProducts}`,
);
console.log(`Multi-variant families: ${report.multiVariantFamilyCount}`);
console.log(
  `Families with >1 representative photo: ${report.representativeImageStats.familiesWithMultipleRepresentativeImages}`,
);
console.log(
  `Average representative photos: ${report.representativeImageStats.averageRepresentativeImageCount}`,
);
console.log(
  `Max representative photos: ${report.representativeImageStats.maxRepresentativeImageCount}`,
);
console.log("\nTop 15 variant families:");
for (const family of [...families]
  .sort((a, b) => b.variantCount - a.variantCount)
  .slice(0, 15)) {
  console.log(`- ${family.brand} · ${family.canonicalName} · ${family.variantCount} variants`);
}
const larroudeTargets = ["Verona Ballet Flat", "Pavlova Ballet Flat", "Stella Sneaker"];
console.log("\nLARROUDE target families:");
for (const target of larroudeTargets) {
  const match = families.find(
    (family) => family.brand === "LARROUDE" && family.canonicalName === target,
  );
  console.log(
    `- ${target}: ${match ? `${match.variantCount} variant(s), ${match.groupingConfidence}` : "not found"}`,
  );
}

const { buildCatalogFrontend } = await import("./build-catalog-frontend");
await buildCatalogFrontend({ force: true });
