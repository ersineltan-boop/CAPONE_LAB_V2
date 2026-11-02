import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { prepareJonakProducts } from "../src/collector/jonak";
import { waveFamiliesToModelFamilies } from "../src/brands/wave50/publish";
import { replaceAutomationBrandDeliveries } from "../src/brands/automation/delivery";
import type { WaveCatalog } from "../src/brands/wave50/types";
import { loadModelFamilies } from "../src/modelFamily/dataset";
import { buildBrandRegistryFromUniverseData } from "../src/registry/build/buildBrandRegistry";

const snapshot = JSON.parse(await readFile("data/brands/jonak-staging/catalog.json", "utf8"));
const progress = JSON.parse(await readFile("data/brands/jonak-staging/progress.json", "utf8"));
if (progress.status !== "LISTING_VERIFIED" || progress.checkedAt !== snapshot.checkedAt) throw new Error("Current traversal not verified");
const prepared = prepareJonakProducts(snapshot);
// Listing galleries alone are insufficient: refuse redirects and HTML in place of image bytes.
for (const index of [...new Set([0, Math.floor(prepared.products.length / 2), prepared.products.length - 1])]) {
  const response = await fetch(prepared.products[index]!.images![0]!, {
    redirect: "manual", signal: AbortSignal.timeout(15_000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  await response.body?.cancel();
  if (!response.ok || !contentType.startsWith("image/")) {
    throw new Error(`JONAK_IMAGE_DELIVERY_BLOCKED: HTTP ${response.status}; ${contentType}; location=${response.headers.get("location") ?? "none"}`);
  }
}
const catalog: WaveCatalog = {
  slug: "jonak", brand: "JONAK", officialUrl: "https://www.jonak-paris.com", snapshotId: snapshot.checkedAt,
  collectedAt: snapshot.checkedAt, catalogPaths: ["/collection/woman-shoes.html"], newArrivalsPaths: [],
  coverage: { sourceTotal: prepared.products.length, collected: prepared.products.length, missing: 0, coverage: 100,
    excluded: prepared.excluded.length, paginationExhausted: true, galleryComplete: prepared.products.length,
    taxonomyPassed: true, womenFootwearOnly: true, sampleOnly: false },
  newArrivalsFootwear: 0, referenceFootwearTotal: null, referenceNewArrivals: null, referenceFootwearMatch: null, referenceNewArrivalsMatch: null,
  productUrls: prepared.products.map(p => p.productUrl),
  families: prepared.products.map(p => ({ modelFamilyId: `jonak--${new URL(p.productUrl).pathname.split("/").at(-1)!.replace(/\.html$/, "")}`,
    brand: "JONAK", canonicalName: p.productName, category: p.category!, images: p.images!, isNew: false, groupingReason: "single-product",
    variants: [{ productUrl: p.productUrl, handle: new URL(p.productUrl).pathname, title: p.productName, color: p.color,
      sku: p.variants[0]?.sku ?? null, images: p.images!, category: p.category!, productType: p.sourceCategoryPath!,
      inNewArrivals: false, isNew: false, newnessEvidence: null }] })),
};
const families = waveFamiliesToModelFamilies(catalog);
if (families.some(f => !f.primaryCategory || f.primaryCategory === "UNCLASSIFIED")) throw new Error("Unresolved primary taxonomy");
const before = await loadModelFamilies();
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const old = new Map(before.map(f => [f.modelFamilyId, digest(f)]));
await replaceAutomationBrandDeliveries({ root: process.cwd(), generatedAt: snapshot.checkedAt,
  deliveries: [{ slug: "jonak", brand: "JONAK", officialUrl: catalog.officialUrl, collectedAt: snapshot.checkedAt, families }] });
const after = await loadModelFamilies();
const current = new Map(after.map(f => [f.modelFamilyId, digest(f)]));
if ([...old].some(([id, hash]) => current.get(id) !== hash)) throw new Error("Existing family changed or lost");
const universePath = "data/registry/brand-universe.json";
const universe = JSON.parse(await readFile(universePath, "utf8"));
const brand = universe.brands.find((b: { id: string }) => b.id === "jonak");
Object.assign(brand, { isActive: true, collectorType: "CUSTOM_ADAPTER", collectionStatus: "READY_AUTOMATIC",
  collectionUrl: catalog.officialUrl, collectionPaths: catalog.catalogPaths,
  footwearCollectionUrls: [catalog.officialUrl + catalog.catalogPaths[0]], collectionDiscoveryStatus: "VERIFIED",
  productLimit: prepared.products.length, backfillLimit: prepared.products.length, preferPilotCache: false,
  supportsMultipleImages: true, notes: `Official listing: ${snapshot.sourceTotal} source rows = ${prepared.products.length} footwear + ${prepared.excluded.length} accessories. Guarded JONAK collector; existing refresh schedule unchanged.` });
await writeFile(universePath, JSON.stringify(universe, null, 2));
const cachePath = "data/registry/brand-probe-cache.json";
const cache = JSON.parse(await readFile(cachePath, "utf8"));
delete cache.entries.jonak;
await writeFile(cachePath, JSON.stringify(cache, null, 2));
// Rebuild only the reviewed entry: historical probe cache must not change other brands.
const built = buildBrandRegistryFromUniverseData({ universeFile: universe, probeCache: cache });
if (!built.ok || !built.brandsTsContent) throw new Error("JONAK registry validation failed");
const registryPath = "src/registry/data/brands.ts";
const registry = await readFile(registryPath, "utf8");
const pattern = /  brand\(\{\n    id: "jonak",[\s\S]*?\n  \}\),/;
const reviewed = built.brandsTsContent.match(pattern)?.[0];
if (!reviewed || !pattern.test(registry)) throw new Error("JONAK registry entry missing");
await writeFile(registryPath, registry.replace(pattern, () => reviewed));
await writeFile("data/registry/jonak-delivery-proof.json", JSON.stringify({ checkedAt: snapshot.checkedAt, sourceRows: snapshot.sourceTotal,
  footwear: prepared.products.length, excludedIds: prepared.excluded, previousFamilies: before.length, nextFamilies: after.length,
  oldIdentitiesAndFieldsPreserved: old.size, archiveHash: digest(snapshot), newFlags: 0 }, null, 2));
console.log(`Prepared ${families.length} JONAK families; preserved ${old.size} old families exactly`);
