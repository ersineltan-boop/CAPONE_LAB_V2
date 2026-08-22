import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { analyzeProducts } from "../analysis/analyzeProduct";
import { buildMarketAnalysis } from "../analysis/buildMarketAnalysis";
import { mergeIncomingSourceIntoCatalog } from "../refresh/refreshPolicy";
import { buildModelFamilies } from "../modelFamily/buildFamilies";
import { loadModelFamilies, writeModelFamilies } from "../modelFamily/dataset";
import type { RawAnalyzedProduct } from "../modelFamily/types";
import type { PilotProduct } from "../collector/types";
import { buildBrandRegistryFromUniverseData } from "../registry/build/buildBrandRegistry";
import { emptyProbeCache } from "../registry/build/probeCache";
import type { BrandUniverseFile } from "../registry/build/types";
import { resetRegistryCache } from "../registry/data";
import { BRANDS_TS_PATH, UNIVERSE_PATH, UNIVERSE_REPORT_PATH } from "./policy";
import { upsertAdapter } from "./adapters";
import { loadAdapterFile, saveAdapterFile } from "./adapterStore";
import type { OnboardingAdapterConfig } from "./types";
import type { QualityGateResult } from "./validate";

export async function mergeValidatedBrandIntoCatalog(input: {
  root: string;
  slug: string;
  products: PilotProduct[];
  status: "success" | "partial";
}): Promise<number> {
  const productsPath = join(input.root, "data/multibrand/products.json");
  const existing = JSON.parse(await readFile(productsPath, "utf-8")) as PilotProduct[];
  const beforeOther = existing
    .filter((product) => product.source !== input.slug)
    .map((product) => product.productUrl)
    .sort();
  const merged = mergeIncomingSourceIntoCatalog({
    existing,
    incoming: input.products,
    status: input.status,
  });
  const afterOther = merged
    .filter((product) => product.source !== input.slug)
    .map((product) => product.productUrl)
    .sort();
  if (beforeOther.join("\n") !== afterOther.join("\n")) {
    throw new Error("Activation aborted: merge would change another source's catalog.");
  }
  await writeFile(productsPath, JSON.stringify(merged, null, 2), "utf-8");
  return merged.length;
}

export async function activateUniverseBrand(input: {
  root: string;
  slug: string;
  adapter: OnboardingAdapterConfig;
  quality: QualityGateResult;
  now?: Date;
}): Promise<void> {
  const universePath = join(input.root, UNIVERSE_PATH);
  const universe = JSON.parse(await readFile(universePath, "utf-8")) as BrandUniverseFile;
  const entry = universe.brands.find((brand) => brand.id === input.slug);
  if (!entry) {
    throw new Error(`Universe entry missing for ${input.slug}`);
  }
  entry.isActive = true;
  entry.collectorType =
    input.adapter.strategy === "shopify-public"
      ? "SHOPIFY_PUBLIC"
      : input.adapter.strategy === "structured-data" || input.adapter.strategy === "sitemap-product-crawl"
        ? "STRUCTURED_DATA"
        : "CUSTOM_ADAPTER";
  entry.collectionStatus = "READY_AUTOMATIC";
  entry.collectionDiscoveryStatus = "AUTO_DISCOVERED";
  entry.collectionPaths = [...(input.adapter.collectionPaths ?? [])];
  entry.footwearCollectionHandles = (input.adapter.footwearPaths ?? [])
    .map((path) => path.replace(/^\/collections\//, ""))
    .filter(Boolean);
  entry.supportsMultipleImages = true;
  entry.productLimit = Math.max(entry.productLimit, 80);
  entry.notes = `Onboarding ${input.quality.completeness}: ${input.adapter.strategy}${
    input.adapter.locale ? ` locale=${input.adapter.locale}` : ""
  }`;

  await writeFile(universePath, JSON.stringify(universe, null, 2), "utf-8");

  const built = buildBrandRegistryFromUniverseData({
    universeFile: universe,
    probeCache: emptyProbeCache(),
  });
  if (!built.ok || !built.brandsTsContent) {
    throw new Error("Failed to rebuild brands.ts after onboarding activation");
  }
  await writeFile(join(input.root, BRANDS_TS_PATH), built.brandsTsContent, "utf-8");
  await writeFile(
    join(input.root, UNIVERSE_REPORT_PATH),
    JSON.stringify(built.report, null, 2),
    "utf-8",
  );
  resetRegistryCache();

  const adapters = upsertAdapter(await loadAdapterFile(input.root), input.slug, input.adapter, input.now);
  await saveAdapterFile(input.root, adapters);
}

export async function rebuildCatalogAfterActivation(root: string): Promise<number> {
  const productsPath = join(root, "data/multibrand/products.json");
  const analyzedPath = join(root, "data/multibrand/analyzed-products.json");
  const products = JSON.parse(await readFile(productsPath, "utf-8")) as PilotProduct[];
  const analyzed = analyzeProducts(products as never);
  const market = buildMarketAnalysis(analyzed);
  await writeFile(analyzedPath, JSON.stringify(analyzed, null, 2), "utf-8");
  await writeFile(join(root, "data/multibrand/market-analysis.json"), JSON.stringify(market, null, 2), "utf-8");

  const galleries = JSON.parse(
    await readFile(join(root, "data/multibrand/product-image-galleries.json"), "utf-8").catch(() => "{}"),
  ) as Record<string, string[]>;
  const prior = await loadModelFamilies();
  const { families, report } = buildModelFamilies(analyzed as unknown as RawAnalyzedProduct[], {
    productImageGalleries: galleries,
    priorFamilies: prior,
  });
  if (families.length === 0) {
    throw new Error("Activation aborted: Model Family rebuild produced zero families.");
  }
  await writeModelFamilies(families);
  await writeFile(join(root, "data/multibrand/model-family-report.json"), JSON.stringify(report, null, 2), "utf-8");
  return report.modelFamilyCount;
}
