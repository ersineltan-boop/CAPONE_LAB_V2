import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { prepareBataProducts, type BataSnapshot } from "../src/collector/bata";
import { waveFamiliesToModelFamilies } from "../src/brands/wave50/publish";
import { replaceAutomationBrandDeliveries } from "../src/brands/automation/delivery";
import type { WaveCatalog, WaveModelFamily } from "../src/brands/wave50/types";
import { loadModelFamilies } from "../src/modelFamily/dataset";
import { buildBrandRegistryFromUniverseData } from "../src/registry/build/buildBrandRegistry";
import type { BrandUniverseFile, BrandUniverseEntry, BrandUniverseBuildReport } from "../src/registry/build/types";

const snapshot: BataSnapshot = JSON.parse(await readFile("data/brands/bata-staging/catalog.json", "utf8"));
const progress = JSON.parse(await readFile("data/brands/bata-staging/progress.json", "utf8"));
if (progress.status !== "SOURCE_VERIFIED" || progress.checkedAt !== snapshot.checkedAt) throw new Error("Current BATA epoch incomplete");
const products = prepareBataProducts(snapshot);
for (const index of [...new Set([0, Math.floor(products.length / 2), products.length - 1])]) {
  const response = await fetch(products[index]!.images![0]!, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
  const type = response.headers.get("content-type") ?? "";
  await response.body?.cancel();
  if (!response.ok || !type.startsWith("image/")) throw new Error(`BATA image delivery unverified: ${response.status} ${type}`);
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const byUrl = new Map(products.map(product => [product.productUrl, product]));
const groups = new Map<string, WaveModelFamily>();
for (const detail of snapshot.products) {
  const product = byUrl.get(detail.url)!;
  // Source-provided shared parent links plus identical own title/category group only verified colourways.
  const key = `${detail.listing.producturl}|${product.category}|${product.productName}`;
  let family = groups.get(key);
  if (!family) {
    family = { modelFamilyId: `bata--${hash(key).slice(0, 24)}`, brand: "BATA", canonicalName: product.productName,
      category: product.category!, images: product.images!, variants: [], isNew: false, groupingReason: "single-product" };
    groups.set(key, family);
  }
  family.variants.push({ productUrl: product.productUrl, handle: new URL(product.productUrl).pathname, title: product.productName,
    color: product.color, sku: product.sourceModelCode ?? null, images: product.images!, category: product.category!,
    productType: product.sourceCategoryName ?? product.category!, inNewArrivals: false, isNew: false, newnessEvidence: null });
  if (family.variants.length > 1) family.groupingReason = "handle-family";
}
const catalog: WaveCatalog = { slug: "bata", brand: "BATA", officialUrl: "https://www.bata.com", snapshotId: snapshot.checkedAt,
  collectedAt: snapshot.checkedAt, catalogPaths: ["/pt/woman/brand/bata/"], newArrivalsPaths: [],
  coverage: { sourceTotal: products.length, collected: products.length, missing: 0, coverage: 100, excluded: snapshot.excludedIds.length,
    paginationExhausted: true, galleryComplete: products.length, taxonomyPassed: true, womenFootwearOnly: true, sampleOnly: false },
  newArrivalsFootwear: 0, referenceFootwearTotal: null, referenceNewArrivals: null, referenceFootwearMatch: null, referenceNewArrivalsMatch: null,
  productUrls: products.map(product => product.productUrl), families: [...groups.values()] };
const families = waveFamiliesToModelFamilies(catalog);
if (families.some(family => !family.primaryCategory || family.primaryCategory === "UNCLASSIFIED")) throw new Error("BATA unresolved primary category");
const before = await loadModelFamilies();
const old = new Map(before.map(family => [family.modelFamilyId, hash(family)]));
await replaceAutomationBrandDeliveries({ root: process.cwd(), generatedAt: snapshot.checkedAt,
  deliveries: [{ slug: "bata", brand: "BATA", officialUrl: catalog.officialUrl, collectedAt: snapshot.checkedAt, families }] });
const after = await loadModelFamilies();
const current = new Map(after.map(family => [family.modelFamilyId, hash(family)]));
if ([...old].some(([id, checksum]) => current.get(id) !== checksum)) throw new Error("Existing model identity/content changed");
const universePath = "data/registry/brand-universe.json";
const universe: BrandUniverseFile = JSON.parse(await readFile(universePath, "utf8"));
if (universe.brands.some(brand => brand.id === "bata")) throw new Error("Existing BATA activation requires an explicit preserving refresh");
const brand: BrandUniverseEntry = { id: "bata", brand: "BATA", officialUrl: "https://www.bata.com", country: "Çekya",
  segment: "MASS_MARKET", influenceRole: "MARKET", trackingPriority: "P2", isActive: true, collectorType: "CUSTOM_ADAPTER",
  collectionStatus: "READY_AUTOMATIC", footwearFocus: "WOMENS_FOOTWEAR", womenFootwearRelevant: true, sourceType: "BRAND",
  notes: `Official Europe PT BATA-only women. ${snapshot.sourceTotal} rows reconciled; ${products.length} footwear; ${snapshot.excludedIds.length} excluded. Country denotes Czech brand origin (official company history). Influence scores not assessed. Existing refresh schedule unchanged.`,
  footwearInfluence: 0, directionalInfluence: 0, commercialInfluence: 0, collectionUrl: "https://www.bata.com",
  collectionPaths: catalog.catalogPaths, footwearCollectionUrls: ["https://www.bata.com/pt/woman/brand/bata/"],
  collectionDiscoveryStatus: "VERIFIED", productLimit: products.length, backfillLimit: products.length,
  supportsMultipleImages: true, preferPilotCache: false, discoverySources: ["official-bata-europe"], classificationStatus: "UNREVIEWED", radarEligible: false };
universe.brands.push(brand);
universe.generatedAt = snapshot.checkedAt;
const built = buildBrandRegistryFromUniverseData({ universeFile: universe, probeCache: { version: 1, updatedAt: snapshot.checkedAt, entries: {} } });
if (!built.ok || !built.brandsTsContent) throw new Error(`Registry invalid: ${built.report.validationErrors.join("; ")}`);
const block = built.brandsTsContent.match(/  brand\(\{\n    id: "bata",[\s\S]*?\n  \}\),?/)?.[0];
if (!block) throw new Error("Generated BATA registry entry missing");
const registryPath = "src/registry/data/brands.ts";
const registry = await readFile(registryPath, "utf8");
const nextRegistry = registry.replace(/\n\];\s*$/, `,\n${block.replace(/,$/, "")}\n];\n`);
if (nextRegistry === registry) throw new Error("Registry insertion failed");
await writeFile(universePath, JSON.stringify(universe, null, 2));
await writeFile(registryPath, nextRegistry);
// Preserve the previous report's existing-brand assessment; update only this brand's contribution.
const reportPath = "data/registry/brand-universe-report.json";
const report: BrandUniverseBuildReport = JSON.parse(await readFile(reportPath, "utf8"));
report.generatedAt = snapshot.checkedAt;
report.totalBrands++; report.activeBrands++; report.readyAutomatic++; report.unreviewedBrands++; report.radarIneligibleBrands++;
for (const [field, key] of [["countryCounts", brand.country], ["segmentCounts", brand.segment], ["priorityCounts", brand.trackingPriority], ["collectorTypeCounts", brand.collectorType]] as const) report[field][key] = (report[field][key] ?? 0) + 1;
await writeFile(reportPath, JSON.stringify(report, null, 2));
const segmentPath = "src/brands/brandPriceSegments.json";
const segments = JSON.parse(await readFile(segmentPath, "utf8"));
segments.push({ id: "bata", name: "BATA", segment: "MASS_MARKET" });
await writeFile(segmentPath, JSON.stringify(segments, null, 2) + "\n");
await writeFile("data/registry/bata-delivery-proof.json", JSON.stringify({ checkedAt: snapshot.checkedAt, sourceRows: snapshot.sourceTotal,
  footwear: products.length, families: families.length, excludedIds: snapshot.excludedIds, previousFamilies: before.length,
  nextFamilies: after.length, previousFieldsPreserved: old.size, newFlags: 0, snapshotHash: hash(snapshot),
  countryEvidence: "https://www.thebatacompany.com/bata-company/history.html" }, null, 2));
console.log(`BATA prepared: ${products.length} products, ${families.length} families; ${old.size} old records unchanged`);
