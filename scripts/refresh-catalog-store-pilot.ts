import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { runMultibrandAnalysis } from "../src/analysis/runMultibrandAnalysis";
import type { AnalyzedProduct } from "../src/analysis/types";
import { replaceAutomationBrandDeliveries } from "../src/brands/automation/delivery";
import { fetchText } from "../src/collector/http";
import { publishMarketplaceDelivery, readMarketplaceDelivery } from "../src/collector/marketplaceDelivery";
import { runMultibrandCollection } from "../src/collector/runMultibrand";
import { createLegacyProductCatalogStore, createShardedProductCatalogStore } from "../src/collector/sourceProductArchive";
import { collect24S } from "../src/collector/twentyFourS";
import type { PilotProduct, SourceCollectionReport } from "../src/collector/types";
import { buildModelFamilies } from "../src/modelFamily/buildFamilies";
import { loadModelFamilies } from "../src/modelFamily/dataset";
import type { RawAnalyzedProduct } from "../src/modelFamily/types";
import { cycleCatalogSnapshot } from "../src/refresh/cycleCatalogSnapshot";
import { buildCatalogFrontend } from "./build-catalog-frontend";
import { publishLocalCatalogSnapshot } from "./catalog-snapshot";

const repo = process.cwd();
const runs = resolve("logs/catalog-pilot");
await mkdir(runs, { recursive: true });
const run = await mkdtemp(join(runs, "source-refresh-"));
console.log(`Isolated refresh: ${run}`);
const data = join(run, "data/multibrand");
const original = join(repo, "data/multibrand");
await mkdir(data, { recursive: true });
await cp(join(original, "model-families"), join(data, "model-families"), { recursive: true });
for (const file of ["collect-state.json", "product-date-enrichment.json"]) {
  await cp(join(original, file), join(data, file));
}
await mkdir(join(run, "data/registry"), { recursive: true });
await cp(join(repo, "data/registry/priority-brand-coverage.json"), join(run, "data/registry/priority-brand-coverage.json"));
const legacy = createLegacyProductCatalogStore(original);
const archive = createShardedProductCatalogStore(join(run, "archive"));
const raw = await legacy.read<PilotProduct>("products");
const analyzed = await legacy.read<AnalyzedProduct>("analyzed-products");
const rawBefore = await archive.write("products", raw);
const analyzedBefore = await archive.write("analyzed-products", analyzed);
const baseline = await cycleCatalogSnapshot(run);
const epoch = new Date().toISOString();
const brandSpecs = [
  { slug: "alohas", brand: "ALOHAS", officialUrl: "https://alohas.com" },
  { slug: "dear-frances", brand: "DEAR FRANCES", officialUrl: "https://dearfrances.com" },
];
const eligibleBrand = (row: SourceCollectionReport) => row.status === "success" && row.parsedProducts > 0 &&
  row.productsWithImages === row.parsedProducts && row.paginationExhausted === true &&
  !row.hitLegacyCap && !row.hitCollectionCrawlCap && typeof row.sourceReportedProductCount === "number" &&
  row.sourceReportedProductCount === row.parsedProducts;
const started = performance.now();
const brands = await runMultibrandCollection({ mode: "full", brandIds: brandSpecs.map(b => b.slug),
  catalog: archive, outputDirectory: data, acceptSource: eligibleBrand });
const accepted = new Set(brandSpecs.filter(b => brands.sources.some(row => row.source === b.brand && eligibleBrand(row))).map(b => b.slug));
console.log("Accepted brands:", [...accepted].join(", ") || "none");
await runMultibrandAnalysis({ directory: data, catalog: archive, sourceIds: accepted });
const freshAnalysis = await archive.read<RawAnalyzedProduct & { source: string }>("analyzed-products");
const priorFamilies = await loadModelFamilies({ rootDir: data, allowMonolithFallback: false });
await replaceAutomationBrandDeliveries({ root: run, generatedAt: epoch, deliveries: brandSpecs.filter(b => accepted.has(b.slug)).map(brand => ({
  ...brand,
  collectedAt: epoch,
  families: buildModelFamilies(freshAnalysis.filter(row => row.source === brand.slug), { priorFamilies }).families,
})) });

const marketPath = join(data, "model-families/marketplaces/24s.json");
const marketBefore = await readMarketplaceDelivery(marketPath);
let requests = 0, stop = "";
const result = await collect24S(async url => {
  if (stop || requests >= 35) return { ok: false, status: 0, url, text: "", error: stop || "Pilot request budget exhausted" };
  requests++;
  const response = await fetchText(url, { delayMs: 250 });
  if ([401, 403, 429].includes(response.status) || /verify you are human|security verification|cf-chl-/i.test(response.text)) {
    stop = `Access restriction at HTTP ${response.status}`;
    return { ...response, ok: false, text: "", error: stop };
  }
  if (!response.ok) stop = response.error ?? `HTTP ${response.status}`;
  return response;
}, 20);
const coverage = result.coverage;
const market = await publishMarketplaceDelivery(run, {
  sourceId: "24s", products: result.products,
  coverageStatus: coverage.status === "FULL" ? "FULL" : coverage.status === "PARTIAL" ? "PARTIAL" : "FAILED",
  sourceTotal: coverage.sourceReportedProductCount,
  rawCollected: coverage.rawProductCount,
  eligibleTotal: coverage.acceptedProductCount,
  paginationExhausted: coverage.pagesTraversed === coverage.expectedPages,
  errors: [...coverage.errors, ...(stop ? [stop] : [])],
}, "https://www.24s.com", archive);
const marketAfter = await readMarketplaceDelivery(marketPath);
if (!market.report.accepted) assert.deepEqual(marketAfter, marketBefore, "Rejected marketplace changed its archive");

const rawAfter = JSON.parse(await readFile(join(run, "archive/products/manifest.json"), "utf8")) as typeof rawBefore;
const analyzedAfter = JSON.parse(await readFile(join(run, "archive/analyzed-products/manifest.json"), "utf8")) as typeof analyzedBefore;
assert.deepEqual(rawAfter.parts.filter(p => !accepted.has(p.source)), rawBefore.parts.filter(p => !accepted.has(p.source)));
assert.deepEqual(analyzedAfter.parts.filter(p => !accepted.has(p.source)), analyzedBefore.parts.filter(p => !accepted.has(p.source)));
const candidate = await cycleCatalogSnapshot(run);
const ids = new Set(candidate.modelIds);
assert(baseline.modelIds.every(id => ids.has(id)), "Refresh lost archived model IDs");
const proposed = new Map((await archive.read<PilotProduct>("products")).map(p => [p.productUrl, p]));
for (const old of raw) {
  const product = proposed.get(old.productUrl);
  assert(product, `Archive lost URL: ${old.productUrl}`);
  const gallery = new Set([product.imageUrl, ...(product.images ?? []), ...product.variants.flatMap(v => v.images ?? [])]);
  assert([old.imageUrl, ...(old.images ?? []), ...old.variants.flatMap(v => v.images ?? [])].every(url => !url || gallery.has(url)),
    `Archive lost gallery URL for ${old.productUrl}`);
}
const frontend = join(run, "frontend");
await buildCatalogFrontend({ outputDir: frontend, dataRoot: run, generatedAt: epoch });
const store = await publishLocalCatalogSnapshot(frontend, join(run, "store"));
const report = {
  brands: brands.sources.map(b => ({ ...b, accepted: brandSpecs.some(s => s.brand === b.source && accepted.has(s.slug)) })),
  marketplace: { requests, coverage, accepted: market.report.accepted, reasons: market.report.reasons, before: marketBefore.families.length, after: marketAfter.families.length },
  baseline: baseline.totalModels, candidate: candidate.totalModels,
  rawParts: rawAfter.parts.length, analyzedParts: analyzedAfter.parts.length,
  largestRawBytes: Math.max(...rawAfter.parts.map(p => p.bytes)),
  largestPublicBytes: store.largestBytes, durationSeconds: Math.round((performance.now() - started) / 1000),
};
await writeFile(join(run, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, marketplace: { ...report.marketplace, coverage: coverage.status } }, null, 2));
