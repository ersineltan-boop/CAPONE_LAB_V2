import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildCatalogDelivery } from "../src/catalog/buildCatalogDelivery";
import { buildVisualDelivery } from "../src/visual/buildVisualDelivery";
import { loadModelFamilies, modelFamilyDatasetMtimeMs } from "../src/modelFamily/dataset";
import { loadBrandRegistry } from "../src/registry/data/index";
import { browsableMarketplaces } from "../src/registry/data/marketplaces";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "data", "catalog");

async function isFresh(): Promise<boolean> {
  try {
    const familiesMtime = await modelFamilyDatasetMtimeMs();
    if (familiesMtime == null) return false;
    const [summaryStat, visualStat] = await Promise.all([
      stat(join(OUT_DIR, "summary.json")),
      stat(join(OUT_DIR, "visual-summary.json")),
    ]);
    return summaryStat.mtimeMs >= familiesMtime && visualStat.mtimeMs >= familiesMtime;
  } catch {
    return false;
  }
}

export async function buildCatalogFrontend(options?: { force?: boolean }): Promise<void> {
  if (!options?.force && (await isFresh())) {
    console.log("Catalog frontend shards are up to date.");
    return;
  }

  const families = await loadModelFamilies();
  const artifacts = buildCatalogDelivery({
    families,
    brands: loadBrandRegistry().all(),
    marketplaces: browsableMarketplaces(),
  });

  await mkdir(join(OUT_DIR, "brands"), { recursive: true });
  await mkdir(join(OUT_DIR, "marketplaces"), { recursive: true });
  await mkdir(join(OUT_DIR, "visual"), { recursive: true });

  await writeFile(join(OUT_DIR, "summary.json"), JSON.stringify(artifacts.summary), "utf-8");
  await writeFile(join(OUT_DIR, "id-index.json"), JSON.stringify(artifacts.idIndex), "utf-8");

  for (const shard of artifacts.brandShards) {
    await writeFile(join(OUT_DIR, "brands", `${shard.id}.json`), JSON.stringify(shard), "utf-8");
  }
  for (const shard of artifacts.marketplaceShards) {
    await writeFile(
      join(OUT_DIR, "marketplaces", `${shard.id}.json`),
      JSON.stringify(shard),
      "utf-8",
    );
  }

  const brandIds: Record<string, string> = {};
  const marketplaceIds: Record<string, string> = {};
  for (const [id, locator] of Object.entries(artifacts.idIndex.families)) {
    if (locator.brandId) brandIds[id] = locator.brandId;
    if (locator.marketplaceId) marketplaceIds[id] = locator.marketplaceId;
  }
  const visual = buildVisualDelivery({
    families,
    generatedAt: artifacts.summary.generatedAt,
    brandIds,
    marketplaceIds,
  });
  await writeFile(join(OUT_DIR, "visual-summary.json"), JSON.stringify(visual.summary), "utf-8");
  for (const shard of visual.shards) {
    await writeFile(join(OUT_DIR, "visual", `${shard.id}.json`), JSON.stringify(shard), "utf-8");
  }

  const largestBrand = artifacts.brandShards.reduce(
    (best, shard) => (JSON.stringify(shard).length > best.size ? { id: shard.id, size: JSON.stringify(shard).length } : best),
    { id: "", size: 0 },
  );

  console.log("\n=== CAPONE Catalog Frontend Delivery ===");
  console.log(`Brands: ${artifacts.brandShards.length}`);
  console.log(`Marketplaces: ${artifacts.marketplaceShards.length}`);
  console.log(`Id index entries: ${Object.keys(artifacts.idIndex.families).length}`);
  console.log(`Visual families: ${visual.summary.totalCount}`);
  console.log(`Largest brand shard: ${largestBrand.id} (${largestBrand.size} bytes)`);
  console.log(`Output: ${OUT_DIR}`);
}

const isDirectRun = process.argv[1]?.replaceAll("\\", "/").endsWith("build-catalog-frontend.ts");
if (isDirectRun) {
  await buildCatalogFrontend({ force: process.argv.includes("--force") });
}
