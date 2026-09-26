import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  omitNonFootwearFamilies,
  productUrlKey,
  reclassifyWaveFamily,
  removeDuplicateVariants,
} from "../src/brands/wave50/deliveryLink";
import {
  atomicWriteJson,
  atomicWriteText,
  readJsonFile,
  WAVE_LAST_GOOD_DIR,
  WAVE_REPORT_PATH,
} from "../src/brands/wave50/publish";
import type { WaveCatalog, WaveRunReport } from "../src/brands/wave50/types";
import type { ModelFamily } from "../src/modelFamily/types";
import type { ModelFamilyDatasetManifest } from "../src/modelFamily/dataset";

const ROOT = join(import.meta.dirname, "..");
const FAMILIES = join(ROOT, "data/multibrand/model-families");
const INITIAL_SITE_DELIVERY_FAMILIES = 286;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function shardNames(): Promise<string[]> {
  return readdir(FAMILIES).then((files) =>
    files.filter((file) => /^part-\d+\.json$/.test(file)).sort(),
  );
}

async function readFamilies(file: string): Promise<ModelFamily[]> {
  return JSON.parse(await readFile(join(FAMILIES, file), "utf-8")) as ModelFamily[];
}

async function mapPool<T>(items: readonly T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
}

async function productCopy(url: string): Promise<{ description: string | null; tags: string | null }> {
  const parsed = new URL(url);
  const handle = parsed.pathname.split("/products/")[1]?.split("?")[0];
  if (!handle) return { description: null, tags: null };
  try {
    const response = await fetch(`${parsed.origin}/products/${handle}.json`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) return { description: null, tags: null };
    const body = (await response.json()) as { product?: { body_html?: string; tags?: string | string[] } };
    const tags = body.product?.tags;
    return {
      description: stripHtml(body.product?.body_html ?? ""),
      tags: Array.isArray(tags) ? tags.join(", ") : (tags ?? null),
    };
  } catch {
    return { description: null, tags: null };
  }
}

async function reclassifyUnclassified(families: ModelFamily[]): Promise<ModelFamily[]> {
  const pending = families.filter((family) => (family.primaryCategory ?? "UNCLASSIFIED") === "UNCLASSIFIED");
  const copies = new Map<string, { description: string | null; tags: string | null }>();
  await mapPool(pending, 8, async (family) => {
    const url = family.variants[0]?.url;
    if (!url) return;
    copies.set(productUrlKey(url), await productCopy(url));
  });
  return families.map((family) => {
    const url = family.variants[0]?.url;
    const copy = url ? copies.get(productUrlKey(url)) : undefined;
    return reclassifyWaveFamily(family, copy ?? null);
  });
}

const files = await shardNames();
const earlierFiles = files.filter((file) => file !== "part-006.json" && file !== "part-007.json");
const delivered: ModelFamily[] = [];
for (const file of earlierFiles) delivered.push(...(await readFamilies(file)));

let part006 = omitNonFootwearFamilies(removeDuplicateVariants(delivered, await readFamilies("part-006.json")));
let part007 = omitNonFootwearFamilies(await readFamilies("part-007.json"));
part006 = await reclassifyUnclassified(part006);
part007 = await reclassifyUnclassified(part007);

const stillUnclassified = [...part006, ...part007].filter(
  (family) => (family.primaryCategory ?? "UNCLASSIFIED") === "UNCLASSIFIED",
);
if (stillUnclassified.length > 0) {
  const sample = stillUnclassified
    .slice(0, 20)
    .map((family) => `${family.brand} | ${family.variants[0]?.title ?? family.canonicalName}`)
    .join("\n");
  throw new Error(`wave shards still have ${stillUnclassified.length} UNCLASSIFIED families\n${sample}`);
}

const part006Body = JSON.stringify(part006);
const part007Body = JSON.stringify(part007);
await atomicWriteText(join(FAMILIES, "part-006.json"), part006Body);
await atomicWriteText(join(FAMILIES, "part-007.json"), part007Body);

const rewrittenBytes = new Map<string, { familyCount: number; bytes: number }>([
  ["part-006.json", { familyCount: part006.length, bytes: Buffer.byteLength(part006Body, "utf8") }],
  ["part-007.json", { familyCount: part007.length, bytes: Buffer.byteLength(part007Body, "utf8") }],
]);

for (const file of earlierFiles) {
  const families = await readFamilies(file);
  const needsCategory = families.some(
    (family) => family.brand === "EXÉ" && (family.primaryCategory ?? "UNCLASSIFIED") === "UNCLASSIFIED",
  );
  if (!needsCategory) continue;
  const reclassified = await reclassifyUnclassified(families);
  const left = reclassified.filter((family) => (family.primaryCategory ?? "UNCLASSIFIED") === "UNCLASSIFIED" && family.brand === "EXÉ");
  if (left.length > 0) {
    throw new Error(`EXÉ still has ${left.length} UNCLASSIFIED families in ${file}`);
  }
  const body = JSON.stringify(reclassified);
  await atomicWriteText(join(FAMILIES, file), body);
  rewrittenBytes.set(file, { familyCount: reclassified.length, bytes: Buffer.byteLength(body, "utf8") });
}

const manifest = await readJsonFile<ModelFamilyDatasetManifest>(join(FAMILIES, "manifest.json"), {
  schema: "capone.model-families.shards.v1",
  version: 1,
  generatedAt: new Date().toISOString(),
  totalFamilies: 0,
  shardCount: 0,
  shards: [],
});
for (const [file, rewritten] of rewrittenBytes) {
  const shard = manifest.shards.find((entry) => entry.file === file);
  if (shard) {
    shard.familyCount = rewritten.familyCount;
    shard.bytes = rewritten.bytes;
    continue;
  }
  manifest.shards.push({ file, familyCount: rewritten.familyCount, bytes: rewritten.bytes });
}
manifest.shards.sort((a, b) => a.file.localeCompare(b.file, "en"));
manifest.totalFamilies = manifest.shards.reduce((sum, shard) => sum + shard.familyCount, 0);
manifest.shardCount = manifest.shards.length;
manifest.generatedAt = new Date().toISOString();
await atomicWriteJson(join(FAMILIES, "manifest.json"), manifest);

const report = await readJsonFile<WaveRunReport>(join(ROOT, WAVE_REPORT_PATH), {
  version: 1,
  generatedAt: new Date().toISOString(),
  concurrency: 10,
  attempted: 0,
  accessible: 0,
  fullCatalogPassed: 0,
  publishedCatalogs: 0,
  customAdapter: 0,
  sourceUnavailable: 0,
  stagingProducts: 0,
  universeBrandsBefore: 159,
  universeBrandsAfter: 160,
  activeBrandsBefore: 50,
  activeBrandsAfter: 52,
  netNewUniverseBrands: 1,
  netNewActiveBrands: 2,
  newActivations: [],
  initialSiteDeliveryFamilies: INITIAL_SITE_DELIVERY_FAMILIES,
  siteDeliveryFamilies: 0,
  siteDeliveryProducts: 0,
  collectTargets: 50,
  outcomes: [],
});

const catalogs: WaveCatalog[] = [];
for (const outcome of report.outcomes) {
  if (!outcome.published) continue;
  const catalog = await readJsonFile<WaveCatalog | null>(
    join(ROOT, WAVE_LAST_GOOD_DIR, `${outcome.slug}.json`),
    null,
  );
  if (catalog) catalogs.push(catalog);
}
const stagingProducts = catalogs.reduce((sum, catalog) => sum + catalog.productUrls.length, 0);
const siteUrls = new Set<string>();
for (const family of [...part006, ...part007]) {
  for (const variant of family.variants) {
    if (variant.url) siteUrls.add(productUrlKey(variant.url));
  }
}

const nextReport: WaveRunReport = {
  ...report,
  publishedCatalogs: report.fullCatalogPassed,
  stagingProducts,
  universeBrandsBefore: 159,
  universeBrandsAfter: 160,
  activeBrandsBefore: 50,
  activeBrandsAfter: 52,
  netNewUniverseBrands: 1,
  netNewActiveBrands: 2,
  newActivations: [
    { slug: "naked-wolfe", brand: "NAKED WOLFE" },
    { slug: "maria-carlota", brand: "MARIA CARLOTA" },
  ],
  initialSiteDeliveryFamilies: INITIAL_SITE_DELIVERY_FAMILIES,
  siteDeliveryFamilies: part006.length + part007.length,
  siteDeliveryProducts: siteUrls.size,
};
delete (nextReport as { addedBrands?: number }).addedBrands;
delete (nextReport as { addedProducts?: number }).addedProducts;
await atomicWriteJson(join(ROOT, WAVE_REPORT_PATH), nextReport);
console.log(
  JSON.stringify({
    part006Families: part006.length,
    part007Families: part007.length,
    publishedCatalogs: nextReport.publishedCatalogs,
    stagingProducts,
    initialSiteDeliveryFamilies: INITIAL_SITE_DELIVERY_FAMILIES,
    siteDeliveryFamilies: nextReport.siteDeliveryFamilies,
    siteDeliveryProducts: nextReport.siteDeliveryProducts,
    totalFamilies: manifest.totalFamilies,
  }),
);
