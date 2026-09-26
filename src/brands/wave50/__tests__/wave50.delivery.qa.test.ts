import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { getCollectableBrands } from "../../../registry/collection/brandToCollector";
import { loadBrandRegistry } from "../../../registry/data";
import type { ModelFamily } from "../../../modelFamily/types";
import type { ModelFamilyDatasetManifest } from "../../../modelFamily/dataset";
import { productUrlKey } from "../deliveryLink";
import type { WaveCatalog, WaveRunReport } from "../types";

const SHORT_CATEGORIES = [
  "BALLET_FLAT",
  "LOAFER",
  "PUMP",
  "SANDAL",
  "MULE",
  "BOOT",
  "SNEAKER",
  "ESPADRILLE",
  "OXFORD_DERBY",
  "CLOG",
] as const;

const FAMILY_DIR = "data/multibrand/model-families";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function shardFamilies(file: string): ModelFamily[] {
  return readJson<ModelFamily[]>(join(FAMILY_DIR, file));
}

function variantUrls(families: readonly ModelFamily[]): Set<string> {
  const urls = new Set<string>();
  for (const family of families) {
    for (const variant of family.variants) {
      if (variant.url) urls.add(productUrlKey(variant.url));
    }
  }
  return urls;
}

describe("brands wave 50 delivery QA", () => {
  const report = readJson<WaveRunReport>("data/registry/brand-wave-50-report.json");
  const universe = readJson<{ brands: Array<{ id: string; brand: string; isActive: boolean }> }>(
    "data/registry/brand-universe.json",
  );
  const manifest = readJson<ModelFamilyDatasetManifest>(join(FAMILY_DIR, "manifest.json"));
  const part006 = shardFamilies("part-006.json");
  const part007 = shardFamilies("part-007.json");
  const waveFamilies = [...part006, ...part007];

  it("reports staging, published catalogs, and net-new brands without addedBrands", () => {
    expect(report).not.toHaveProperty("addedBrands");
    expect(report).not.toHaveProperty("addedProducts");
    expect(report.publishedCatalogs).toBe(44);
    expect(report.fullCatalogPassed).toBe(44);
    expect(report.stagingProducts).toBe(11556);
    expect(report.universeBrandsBefore).toBe(159);
    expect(report.universeBrandsAfter).toBe(160);
    expect(report.activeBrandsBefore).toBe(50);
    expect(report.activeBrandsAfter).toBe(52);
    expect(report.netNewUniverseBrands).toBe(1);
    expect(report.netNewActiveBrands).toBe(2);
    expect(report.newActivations).toEqual([
      { slug: "naked-wolfe", brand: "NAKED WOLFE" },
      { slug: "maria-carlota", brand: "MARIA CARLOTA" },
    ]);
    expect(report.initialSiteDeliveryFamilies).toBe(286);

    const published = report.outcomes.filter((outcome) => outcome.published);
    expect(published).toHaveLength(44);
    const stagingProducts = published.reduce((sum, outcome) => {
      const catalog = readJson<WaveCatalog>(`data/brands/wave50/last-good/${outcome.slug}.json`);
      return sum + catalog.productUrls.length;
    }, 0);
    expect(stagingProducts).toBe(report.stagingProducts);

    expect(universe.brands).toHaveLength(160);
    expect(universe.brands.filter((brand) => brand.isActive)).toHaveLength(52);
    expect(universe.brands.find((brand) => brand.id === "naked-wolfe")?.isActive).toBe(true);
    expect(universe.brands.find((brand) => brand.id === "maria-carlota")?.isActive).toBe(true);
    expect(getCollectableBrands(loadBrandRegistry().all())).toHaveLength(52);
    expect(report.universeBrandsAfter - report.universeBrandsBefore).toBe(report.netNewUniverseBrands);
    expect(report.activeBrandsAfter - report.activeBrandsBefore).toBe(report.netNewActiveBrands);
  });

  it("counts user-visible wave families and products from shards, not products.json", () => {
    const urls = variantUrls(waveFamilies);
    expect(report.siteDeliveryFamilies).toBe(waveFamilies.length);
    expect(report.siteDeliveryProducts).toBe(urls.size);
    expect(report.siteDeliveryFamilies).toBeGreaterThan(report.initialSiteDeliveryFamilies);
    const part006Shard = manifest.shards.find((shard) => shard.file === "part-006.json");
    const part007Shard = manifest.shards.find((shard) => shard.file === "part-007.json");
    expect(part006Shard?.familyCount).toBe(part006.length);
    expect(part007Shard?.familyCount).toBe(part007.length);
    expect(manifest.totalFamilies).toBe(manifest.shards.reduce((sum, shard) => sum + shard.familyCount, 0));

    const products = readFileSync("data/multibrand/products.json", "utf-8");
    const nakedWolfeInProducts = products.match(/nakedwolfe\.com\/products/g)?.length ?? 0;
    expect(nakedWolfeInProducts).toBeLessThan(30);
  });

  it("keeps wave families in short footwear categories and does not duplicate product urls", () => {
    const unclassified = waveFamilies.filter((family) => (family.primaryCategory ?? "UNCLASSIFIED") === "UNCLASSIFIED");
    expect(unclassified).toEqual([]);
    for (const family of waveFamilies) {
      expect(SHORT_CATEGORIES).toContain(family.primaryCategory);
    }

    const nakedWolfe = part006.filter((family) => family.brand === "NAKED WOLFE");
    const exe = readdirSync(FAMILY_DIR)
      .filter((file) => /^part-\d+\.json$/.test(file))
      .flatMap((file) => shardFamilies(file))
      .filter((family) => family.brand === "EXÉ");
    expect(nakedWolfe).toHaveLength(114);
    expect(exe.length).toBeGreaterThan(0);
    expect(nakedWolfe.every((family) => family.primaryCategory !== "UNCLASSIFIED")).toBe(true);
    expect(exe.every((family) => family.primaryCategory !== "UNCLASSIFIED")).toBe(true);

    const titles = waveFamilies.flatMap((family) => family.variants.map((variant) => variant.title.toLowerCase()));
    expect(titles.some((title) => /\bchaussettes?\b|\bsocks?\b/.test(title))).toBe(false);
    expect(titles.some((title) => /\bsac\b/.test(title))).toBe(false);

    const earlier = new Set<string>();
    for (const file of readdirSync(FAMILY_DIR)) {
      if (!/^part-00[0-5]\.json$/.test(file)) continue;
      for (const url of variantUrls(shardFamilies(file))) earlier.add(url);
    }
    const part006Urls = variantUrls(part006);
    const part007Urls = variantUrls(part007);
    for (const url of part006Urls) expect(earlier.has(url)).toBe(false);
    for (const url of part007Urls) {
      expect(earlier.has(url)).toBe(false);
      expect(part006Urls.has(url)).toBe(false);
    }
  });

  it("does not mark the Naked Wolfe baseline catalog new", () => {
    const catalog = readJson<WaveCatalog>("data/brands/wave50/last-good/naked-wolfe.json");
    const newVariants = catalog.families.flatMap((family) => family.variants).filter((variant) => variant.isNew);
    expect(catalog.productUrls).toHaveLength(328);
    expect(catalog.newArrivalsFootwear).toBe(126);
    expect(newVariants).toHaveLength(126);
    expect(newVariants.length).toBeLessThan(catalog.productUrls.length);

    const nakedWolfe = part006.filter((family) => family.brand === "NAKED WOLFE");
    const verifiedNew = nakedWolfe.filter((family) =>
      family.sourceSightings?.some((sighting) => sighting.newness.status === "VERIFIED_NEW"),
    );
    const baseline = nakedWolfe.filter((family) =>
      family.sourceSightings?.every((sighting) => sighting.newness.status !== "VERIFIED_NEW"),
    );
    expect(verifiedNew.length).toBeGreaterThan(0);
    expect(baseline.length).toBeGreaterThan(0);
    expect(verifiedNew.length).toBeLessThan(nakedWolfe.length);
  });
});
