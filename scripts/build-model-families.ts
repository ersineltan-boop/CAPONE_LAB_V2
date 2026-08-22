import { readFile, writeFile, mkdir, unlink, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildModelFamilies } from "../src/modelFamily/buildFamilies";
import { loadModelFamilies, writeModelFamilies } from "../src/modelFamily/dataset";
import type { RawAnalyzedProduct } from "../src/modelFamily/types";
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
const priorFamilies = await loadModelFamilies();

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

const reportPath = join(MULTIBRAND_DIR, "model-family-report.json");

async function writeWithRetry(path: string, body: string): Promise<void> {
  const tmp = `${path}.${process.pid}.tmp`;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await writeFile(tmp, body, "utf-8");
      try {
        await unlink(path);
      } catch {
        // ignore
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

const manifest = await writeModelFamilies(families);
await writeWithRetry(reportPath, JSON.stringify(report, null, 2));

console.log("\n=== CAPONE LAB Model Family Deduplication ===");
console.log(`Raw products: ${report.rawProductCount}`);
console.log(`Canonical models: ${report.modelFamilyCount}`);
console.log(`Shards: ${manifest.shardCount}`);
console.log(
  `Largest shard: ${(Math.max(0, ...manifest.shards.map((shard) => shard.bytes)) / (1024 * 1024)).toFixed(2)} MB`,
);
console.log(`Manifest: data/multibrand/model-families/manifest.json`);
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
