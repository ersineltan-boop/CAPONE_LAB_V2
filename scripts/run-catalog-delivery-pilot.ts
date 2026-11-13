import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { applyMarketplaceDeliveries, loadMarketplaceDeliveries } from "../src/collector/marketplaceDelivery";
import { loadModelFamilies } from "../src/modelFamily/dataset";
import { buildCatalogFrontend } from "./build-catalog-frontend";
import { publishLocalCatalogSnapshot } from "./catalog-snapshot";
import { readSourceArchive, writeSourceArchive } from "./catalog-source-archive";

type RawRow = { source: string; productUrl: string; productName: string };
const root = process.cwd();
const pilotRoot = resolve("logs/catalog-pilot");
await mkdir(pilotRoot, { recursive: true });
const run = await mkdtemp(join(pilotRoot, "run-"));
const frontend = join(run, "frontend");
const store = join(run, "store");
const archive = join(run, "archives");
const epoch = new Date().toISOString();

const rawStats = [];
let products: RawRow[] = [];
for (const kind of ["products", "analyzed-products"]) {
  const file = await readFile(join(root, `data/multibrand/${kind}.json`), "utf8");
  const rows: RawRow[] = JSON.parse(file);
  if (kind === "products") products = rows;
  const started = performance.now();
  const dir = join(archive, kind);
  const saved = await writeSourceArchive(rows, dir);
  const restored = await readSourceArchive<RawRow>(dir);
  assert.equal(JSON.stringify(restored), JSON.stringify(rows));
  rawStats.push({ kind, rows: rows.length, originalBytes: Buffer.byteLength(file), parts: saved.parts.length,
    largestPartBytes: Math.max(...saved.parts.map(p => p.bytes)), roundTripMs: Math.round(performance.now() - started) });
}

const families = applyMarketplaceDeliveries(await loadModelFamilies(), await loadMarketplaceDeliveries(root));
assert(families.length > 0, "No existing families loaded");
const started = performance.now();
await buildCatalogFrontend({ outputDir: frontend, families, generatedAt: epoch });
const baseline = await publishLocalCatalogSnapshot(frontend, store);
await writeFile(join(run, "baseline-manifest.json"), JSON.stringify(baseline.manifest));
const baselineMs = Math.round(performance.now() - started);
const official = ["alohas", "pretty-ballerinas", "bata"];
const held = "marketplaces/farfetch.json";
assert(Object.hasOwn(baseline.manifest.files, held));

// Replay a controlled edit to one real catalog family; a rejected marketplace
// candidate is never applied. No invented model or NEW flag is introduced.
const alohas = JSON.parse(await readFile(join(frontend, "brands/alohas.json"), "utf8"));
const id: string = alohas.families[0].modelFamilyId;
const original = families.find(family => family.modelFamilyId === id);
assert(original);
const updated = families.map(family => family.modelFamilyId === id
  ? { ...family, canonicalName: `${family.canonicalName} [pilot replay]` }
  : family);
const nextStart = performance.now();
await buildCatalogFrontend({ outputDir: frontend, families: updated, generatedAt: epoch });
const next = await publishLocalCatalogSnapshot(frontend, store);
const updateMs = Math.round(performance.now() - nextStart);
const changed = Object.keys(next.manifest.files).filter(path =>
  JSON.stringify(baseline.manifest.files[path]) !== JSON.stringify(next.manifest.files[path]));
assert(changed.includes("brands/alohas.json") && changed.includes("visual/tumu.json"));
assert(!changed.some(path => /^(?:brands|marketplaces)\//.test(path) && path !== "brands/alohas.json"));
assert.deepEqual(next.manifest.files[held], baseline.manifest.files[held]);
for (const brand of official) assert(Object.hasOwn(next.manifest.files, `brands/${brand}.json`));
const oldEntry = baseline.manifest.files["brands/alohas.json"]!;
const old = JSON.parse(await readFile(join(store, typeof oldEntry === "string" ? oldEntry : oldEntry.parts[0]!), "utf8"));
assert.equal(old.families[0].canonicalName, original.canonicalName);

// A failed publication must leave the last visible manifest intact.
const pointer = await readFile(join(store, "manifest.json"), "utf8");
await assert.rejects(publishLocalCatalogSnapshot(join(run, "missing"), store));
assert.equal(await readFile(join(store, "manifest.json"), "utf8"), pointer);

const summary = JSON.parse(await readFile(join(frontend, "summary.json"), "utf8"));
const marketIds = new Set<string>(summary.marketplaces.map((m: { sourceId: string }) => m.sourceId));
const brandBuckets = new Map<string, RawRow[]>();
for (const row of products) {
  if (marketIds.has(row.source)) continue;
  const group = brandBuckets.get(row.source) ?? [];
  if (!brandBuckets.has(row.source)) brandBuckets.set(row.source, group);
  group.push(row);
}
const buckets = [...brandBuckets.values()];
assert(buckets.length > 0);
const extra = 160 - brandBuckets.size;
assert(extra >= 0, "Baseline already exceeds pilot target");
const extraRows = Array.from({ length: extra }, (_, i) => buckets[i % buckets.length]!
  .map(row => ({ ...row, source: `pilot-brand-${i + 1}` }))).flat();
const scaleStart = performance.now();
const scale = await writeSourceArchive([...products, ...extraRows], join(archive, "scale-160"));
const scaleMs = Math.round(performance.now() - scaleStart);
const brandFiles = await readdir(join(frontend, "brands"));
const brandSizes = await Promise.all(brandFiles.map(async file => (await readFile(join(frontend, "brands", file))).length));
const projectedBrandBytes = Math.round(brandSizes.reduce((a, b) => a + b, 0) * 160 / brandSizes.length);
const report = {
  baseline: { brands: summary.brands.length, marketplaces: summary.marketplaces.length, files: Object.keys(baseline.manifest.files).length,
    ms: baselineMs, bytes: baseline.totalBytes, largestBytes: baseline.largestBytes },
  replay: { brands: official, marketplace: "farfetch", changed, bytesWritten: next.bytesWritten, ms: updateMs, store, id, originalName: original.canonicalName },
  rawStats,
  scale: { targetCatalogBrands: 160, originalRawBrandBuckets: brandBuckets.size, syntheticRawBrandBuckets: extra, rawRows: scale.order.length,
    rawBytes: scale.parts.reduce((sum, part) => sum + part.bytes, 0), parts: scale.parts.length,
    largestPartBytes: Math.max(...scale.parts.map(part => part.bytes)), rawArchiveMs: scaleMs, projectedBrandBytes },
};
await writeFile(join(run, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
