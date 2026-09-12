import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { FREE_PEOPLE_ID } from "../src/collector/freePeople";
import {
  freePeopleCatalogIdentity,
  mergeFreePeopleStagingIntoCatalog,
} from "../src/collector/mergeFreePeopleStaging";
import { validateFreePeopleStaging } from "../src/collector/validateFreePeopleStaging";
import type { PilotProduct } from "../src/collector/types";
import { listingIdentityKey, MARKETPLACE_SOURCE_IDS } from "../src/modelFamily/sourceIdentity";
import type { RawAnalyzedProduct } from "../src/modelFamily/types";
import type { MarketplacePilotState } from "../src/registry/data/marketplaces";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS = join(ROOT, "data", "multibrand", "products.json");
const BACKUP = join(ROOT, "data", "multibrand", "products.pre-free-people-merge.json");
const STAGING_DIR = join(ROOT, "data", "onboarding", "staging", "free-people");
const STAGING_PRODUCTS = join(STAGING_DIR, "products.json");
const PILOT = join(ROOT, "data", "registry", "marketplace-pilot.json");
const REPORT = join(STAGING_DIR, "production-merge-report.json");

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function isOfficial(product: PilotProduct): boolean {
  return !MARKETPLACE_SOURCE_IDS.has(product.source.trim().toLowerCase());
}

function sourceCounts(products: PilotProduct[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const product of products) {
    counts[product.source] = (counts[product.source] ?? 0) + 1;
  }
  return counts;
}

function brandCounts(products: PilotProduct[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const product of products) {
    counts[product.brand] = (counts[product.brand] ?? 0) + 1;
  }
  return counts;
}

async function main() {
  const beforeBuf = await readFile(PRODUCTS);
  const beforeHash = sha256(beforeBuf);
  const beforeProducts = JSON.parse(beforeBuf.toString("utf-8")) as PilotProduct[];
  const beforeOfficial = beforeProducts.filter(isOfficial);
  const beforeOfficialBrands = new Set(beforeOfficial.map((product) => product.brand));
  const beforeOfficialIdentities = beforeOfficial
    .map((product) => listingIdentityKey(product as unknown as RawAnalyzedProduct))
    .sort();
  const beforeFarfetch = beforeProducts.filter((product) => product.source === "farfetch").length;
  const beforeLevel = beforeProducts.filter((product) => product.source === "level-shoes").length;

  await copyFile(PRODUCTS, BACKUP);

  const staging = JSON.parse(await readFile(STAGING_PRODUCTS, "utf-8")) as PilotProduct[];
  const stagingErrors = validateFreePeopleStaging(staging);
  if (stagingErrors.length) {
    throw new Error(`Staging dataset failed validation:\n${stagingErrors.join("\n")}`);
  }

  const first = mergeFreePeopleStagingIntoCatalog(beforeProducts, staging);
  if (first.skipped.length) {
    throw new Error(`Merge skipped ${first.skipped.length} products: ${JSON.stringify(first.skipped.slice(0, 5))}`);
  }
  await writeFile(PRODUCTS, JSON.stringify(first.products, null, 2), "utf-8");
  const afterFirstCount = first.products.length;

  const afterFirst = JSON.parse(await readFile(PRODUCTS, "utf-8")) as PilotProduct[];
  const second = mergeFreePeopleStagingIntoCatalog(afterFirst, staging);
  await writeFile(PRODUCTS, JSON.stringify(second.products, null, 2), "utf-8");
  const afterSecondCount = second.products.length;

  const merged = second.products;
  const afterOfficial = merged.filter(isOfficial);
  const afterOfficialIdentities = afterOfficial
    .map((product) => listingIdentityKey(product as unknown as RawAnalyzedProduct))
    .sort();
  const fp = merged.filter((product) => product.source === FREE_PEOPLE_ID);
  const fpBrands = brandCounts(fp);
  const top20 = Object.entries(fpBrands)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([brand, productCount]) => ({ brand, productCount }));

  const missing = {
    brand: fp.filter((product) => !product.brand.trim()).length,
    color: fp.filter((product) => !String(product.color ?? "").trim()).length,
    image: fp.filter((product) => !(product.images?.length || product.imageUrl)).length,
    price: fp.filter((product) => !product.details || !/price=/.test(product.details)).length,
    url: fp.filter((product) => !product.productUrl).length,
  };

  const officialIdentityUnchanged =
    beforeOfficialIdentities.length === afterOfficialIdentities.length &&
    beforeOfficialIdentities.every((identity, index) => identity === afterOfficialIdentities[index]);

  const collisions = {
    vsOfficial: 0,
    vsFarfetch: 0,
    vsLevelShoes: 0,
    crossBrand: 0,
  };
  const fpIdentities = new Set(fp.map((product) => freePeopleCatalogIdentity(product)));
  const officialSet = new Set(
    afterOfficial.map((product) => listingIdentityKey(product as unknown as RawAnalyzedProduct)),
  );
  const farfetchSet = new Set(
    merged
      .filter((product) => product.source === "farfetch")
      .map((product) => listingIdentityKey(product as unknown as RawAnalyzedProduct)),
  );
  const levelSet = new Set(
    merged
      .filter((product) => product.source === "level-shoes")
      .map((product) => listingIdentityKey(product as unknown as RawAnalyzedProduct)),
  );
  for (const identity of fpIdentities) {
    if (!identity) continue;
    if (officialSet.has(identity)) collisions.vsOfficial += 1;
    if (farfetchSet.has(identity)) collisions.vsFarfetch += 1;
    if (levelSet.has(identity)) collisions.vsLevelShoes += 1;
  }
  const byIdentityBrand = new Map<string, Set<string>>();
  for (const product of fp) {
    const identity = freePeopleCatalogIdentity(product) ?? "";
    const set = byIdentityBrand.get(identity) ?? new Set<string>();
    set.add(product.brand);
    byIdentityBrand.set(identity, set);
  }
  collisions.crossBrand = [...byIdentityBrand.values()].filter((set) => set.size > 1).length;

  const named = (needle: string) =>
    fp.filter((product) => product.brand.toLowerCase() === needle.toLowerCase()).length;

  const pilot = JSON.parse(await readFile(PILOT, "utf-8")) as MarketplacePilotState;
  const ids = new Set(pilot.activeMarketplaceIds ?? []);
  ids.add("level-shoes");
  ids.add("farfetch");
  ids.add(FREE_PEOPLE_ID);
  const nextPilot: MarketplacePilotState = {
    ...pilot,
    activePilotId: "level-shoes",
    activeMarketplaceIds: [...ids],
    notes:
      "Level Shoes + Farfetch + Free People. Free People is a retailer marketplace; listed product brands are preserved.",
  };
  await mkdir(dirname(PILOT), { recursive: true });
  await writeFile(PILOT, JSON.stringify(nextPilot, null, 2), "utf-8");

  const report = {
    generatedAt: new Date().toISOString(),
    backupPath: BACKUP,
    before: {
      productsJsonSha256: beforeHash,
      catalogCount: beforeProducts.length,
      officialProductCount: beforeOfficial.length,
      officialBrandCount: beforeOfficialBrands.size,
      sourceCounts: sourceCounts(beforeProducts),
      farfetch: beforeFarfetch,
      levelShoes: beforeLevel,
      freePeople: beforeProducts.filter((product) => product.source === FREE_PEOPLE_ID).length,
    },
    staging: {
      products: staging.length,
      brands: Object.keys(brandCounts(staging)).length,
      validationErrors: stagingErrors,
    },
    afterFirstMergeCount: afterFirstCount,
    afterSecondMergeCount: afterSecondCount,
    idempotentDelta: afterSecondCount - afterFirstCount,
    after: {
      catalogCount: merged.length,
      netIncrease: merged.length - beforeProducts.length,
      freePeopleCount: fp.length,
      uniqueFreePeopleBrands: Object.keys(fpBrands).length,
      officialProductCount: afterOfficial.length,
      officialBrandCount: new Set(afterOfficial.map((product) => product.brand)).size,
      officialIdentitiesUnchanged: officialIdentityUnchanged,
      sourceCounts: sourceCounts(merged),
      farfetch: merged.filter((product) => product.source === "farfetch").length,
      levelShoes: merged.filter((product) => product.source === "level-shoes").length,
    },
    merge: {
      addedFirst: first.added,
      replacedFirst: first.replaced,
      addedSecond: second.added,
      replacedSecond: second.replaced,
      skipped: first.skipped.length,
    },
    collisions,
    dataQuality: missing,
    top20FreePeopleBrands: top20,
    namedBrands: {
      Birkenstock: named("Birkenstock"),
      "Jeffrey Campbell": named("Jeffrey Campbell"),
      "FP Collection": named("FP Collection"),
      "We The Free": named("We The Free"),
      "FP Vegan Collection": named("FP Vegan Collection"),
      UGG: named("UGG"),
    },
  };

  await mkdir(STAGING_DIR, { recursive: true });
  await writeFile(REPORT, JSON.stringify(report, null, 2), "utf-8");
  console.log(JSON.stringify(report, null, 2));

  if (report.idempotentDelta !== 0) {
    throw new Error(`Idempotency failed: second merge delta ${report.idempotentDelta}`);
  }
  if (!officialIdentityUnchanged) {
    throw new Error("Official source identities changed during Free People merge");
  }
  if (collisions.vsOfficial || collisions.vsFarfetch || collisions.vsLevelShoes || collisions.crossBrand) {
    throw new Error(`Identity collisions detected: ${JSON.stringify(collisions)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
