import { mkdir, readFile, writeFile, unlink, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadModelFamilies } from "../src/modelFamily/dataset";
import { isGenericModelTitle } from "../src/modelFamily/genericModelTitle";
import type { ModelFamily } from "../src/modelFamily/types";
import { getCollectableBrands } from "../src/registry/collection/brandToCollector";
import { brandEntries } from "../src/registry/data/brands";
import { browsableMarketplaces } from "../src/registry/data/marketplaces";
import type { PilotProduct } from "../src/collector/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

interface FamilyMetrics {
  total: number;
  multiVariant: number;
  multiColor: number;
  ge10: number;
  ge20: number;
  ge30: number;
  ge50: number;
  genericTitle: number;
  largest: Array<{
    brand: string;
    canonicalName: string;
    modelFamilyId: string;
    variantCount: number;
  }>;
}

interface BeforeSnapshot {
  capturedAt?: string;
  metrics?: FamilyMetrics;
  perBrandCounts?: Record<string, { families: number; suspicious?: number }>;
  families: ModelFamily[];
}

function distinctColors(family: ModelFamily): number {
  return new Set(family.variants.map((variant) => variant.color).filter(Boolean)).size;
}

function metricsOf(families: ModelFamily[]): FamilyMetrics {
  const genericTitle = families.filter((family) => isGenericModelTitle(family.canonicalName)).length;
  const largest = [...families]
    .sort((a, b) => b.variantCount - a.variantCount)
    .slice(0, 30)
    .map((family) => ({
      brand: family.brand,
      canonicalName: family.canonicalName,
      modelFamilyId: family.modelFamilyId,
      variantCount: family.variantCount,
    }));
  return {
    total: families.length,
    multiVariant: families.filter((family) => family.variantCount > 1).length,
    multiColor: families.filter((family) => distinctColors(family) > 1).length,
    ge10: families.filter((family) => family.variantCount >= 10).length,
    ge20: families.filter((family) => family.variantCount >= 20).length,
    ge30: families.filter((family) => family.variantCount >= 30).length,
    ge50: families.filter((family) => family.variantCount >= 50).length,
    genericTitle,
    largest,
  };
}

function suspiciousReasons(family: ModelFamily): string[] {
  const reasons: string[] = [];
  const genericTitle = isGenericModelTitle(family.canonicalName);
  const styleBacked = family.groupingReason.startsWith("styleCode:");
  if (genericTitle && family.variantCount > 1 && !styleBacked) {
    reasons.push("generic-title-multi-variant");
  }
  if (family.variantCount >= 10 && !styleBacked) reasons.push("extreme-variant-count");
  if (family.groupingReason.startsWith("normalizedName:") && genericTitle) {
    reasons.push("generic-name-merge");
  }
  const titles = family.variants.map((variant) => variant.title.toLowerCase());
  const boot = titles.some((title) => /\bboot/.test(title));
  const sandal = titles.some((title) => /\bsandal/.test(title));
  const sneaker = titles.some((title) => /\bsneaker/.test(title));
  if ([boot, sandal, sneaker].filter(Boolean).length > 1) {
    reasons.push("incompatible-silhouette-titles");
  }
  return reasons;
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

const products = await readJson<PilotProduct[]>(join(ROOT, "data", "multibrand", "products.json"), []);
const snapshot = await readJson<BeforeSnapshot>(
  join(ROOT, "data", "registry", "model-family-before-snapshot.json"),
  { families: [] },
);
const after = await loadModelFamilies();
const beforeFamilies = snapshot.families ?? [];

const afterByProduct = new Map<string, string>();
for (const family of after) {
  for (const productId of family.sourceProductIds) {
    afterByProduct.set(productId, family.modelFamilyId);
  }
}

const flagged = [];
for (const family of beforeFamilies) {
  const reasons = suspiciousReasons(family);
  if (reasons.length === 0) continue;
  const resulting = [
    ...new Set(
      family.sourceProductIds
        .map((id) => afterByProduct.get(id))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const action = resulting.length > 1 ? "SPLIT" : family.variantCount > 1 ? "REVIEW" : "KEEP";
  flagged.push({
    brand: family.brand,
    source: family.sourceSightings?.[0]?.source ?? null,
    modelFamilyId: family.modelFamilyId,
    canonicalName: family.canonicalName,
    sourceProductCount: family.sourceProductIds.length,
    colorVariantCount: distinctColors(family),
    sourceProductIds: family.sourceProductIds.slice(0, 40),
    productUrls: family.variants.slice(0, 12).map((variant) => variant.url),
    sourceCategories: family.sourceCategoryRefs?.map((ref) => ref.categoryName) ?? [],
    reasonFlagged: reasons,
    genericTitle: isGenericModelTitle(family.canonicalName),
    incompatibleCategoryEvidence: reasons.includes("incompatible-silhouette-titles"),
    incompatibleSourceIdentityEvidence: reasons.includes("generic-name-merge"),
    actionTaken: action,
    resultingFamilyIds: resulting,
  });
}

const collectable = getCollectableBrands(brandEntries);
const mp = new Set(["farfetch", "level-shoes", "free-people", "mytheresa"]);
const afterByBrand = new Map<string, ModelFamily[]>();
for (const family of after) {
  const key = family.brand.trim().toUpperCase();
  const list = afterByBrand.get(key) ?? [];
  list.push(family);
  afterByBrand.set(key, list);
}

const brandRows = collectable.map((entry) => {
  const name = entry.brand.trim().toUpperCase();
  const sourceProducts = products.filter(
    (product) =>
      product.brand.trim().toUpperCase() === name && !mp.has(product.source.toLowerCase()),
  ).length;
  const afterFamilies = afterByBrand.get(name) ?? [];
  const beforeCount = snapshot.perBrandCounts?.[name]?.families ?? 0;
  const suspiciousBefore = snapshot.perBrandCounts?.[name]?.suspicious ?? 0;
  const split = flagged.filter(
    (item) => item.brand.trim().toUpperCase() === name && item.actionTaken === "SPLIT",
  ).length;
  const remaining = afterFamilies.filter((family) => suspiciousReasons(family).length > 0);
  return {
    brand: entry.brand,
    id: entry.id,
    sourceProducts,
    familiesBefore: beforeCount,
    familiesAfter: afterFamilies.length,
    suspiciousBefore,
    familiesSplit: split,
    remainingSuspicious: remaining.length,
    maxVariantCountAfter: afterFamilies.reduce((max, family) => Math.max(max, family.variantCount), 0),
    genericTitleFamiliesRemaining: afterFamilies.filter((family) =>
      isGenericModelTitle(family.canonicalName),
    ).length,
    status: remaining.length === 0 ? "CLEAN" : "REVIEW",
  };
});

const sourceByUrl = new Map(products.map((product) => [product.productUrl, product.source.toLowerCase()]));
const marketplaceRows = browsableMarketplaces().map((entry) => {
  const sourceProducts = products.filter((product) => product.source.toLowerCase() === entry.id).length;
  const afterSource = after.filter((family) =>
    family.sourceProductIds.some((id) => sourceByUrl.get(id) === entry.id),
  );
  return {
    id: entry.id,
    name: entry.name,
    sourceProducts,
    familiesAfter: afterSource.length,
    maxVariantCountAfter: afterSource.reduce((max, family) => Math.max(max, family.variantCount), 0),
    genericTitleFamilies: afterSource.filter((family) => isGenericModelTitle(family.canonicalName)).length,
    remainingSuspicious: afterSource.filter((family) => suspiciousReasons(family).length > 0).length,
  };
});

function familyHits(brand: string, name: string): ModelFamily[] {
  const needle = name.trim().toLowerCase();
  return after.filter(
    (family) =>
      family.brand.trim().toUpperCase() === brand &&
      family.canonicalName.trim().toLowerCase() === needle,
  );
}

function specialRow(brand: string, name: string) {
  const matches = familyHits(brand, name);
  const maxVariants = matches.reduce((max, family) => Math.max(max, family.variantCount), 0);
  const examples = matches.slice(0, 8).map((family) => ({
    modelFamilyId: family.modelFamilyId,
    variantCount: family.variantCount,
    groupingReason: family.groupingReason,
    sampleUrls: family.sourceProductIds.slice(0, 4),
  }));
  return {
    brand,
    name,
    familyCount: matches.length,
    maxVariantCount: maxVariants,
    genericTitle: isGenericModelTitle(name),
    splitConfirmed: matches.length === 0 || maxVariants <= 3,
    examples,
  };
}

const specialValidation = {
  zara: ["Flat", "Slingback", "Heeled Sandals", "Wedge", "Ballerina", "Sneaker", "Boot"].map((name) =>
    specialRow("ZARA", name),
  ),
  parisTexas: ["Boot", "Ankle Boot", "Mule", "Slingback"].map((name) =>
    specialRow("PARIS TEXAS", name),
  ),
};

const remainingAfter = after
  .filter((family) => suspiciousReasons(family).length > 0)
  .sort((a, b) => b.variantCount - a.variantCount)
  .slice(0, 40)
  .map((family) => ({
    brand: family.brand,
    canonicalName: family.canonicalName,
    modelFamilyId: family.modelFamilyId,
    variantCount: family.variantCount,
    reasons: suspiciousReasons(family),
    groupingReason: family.groupingReason,
  }));

const report = {
  generatedAt: new Date().toISOString(),
  rootCause:
    "Model Families merged on normalized generic titles (Boot/Flat/Slingback) plus structural category signatures, without requiring source style/product IDs.",
  before: snapshot.metrics ?? metricsOf(beforeFamilies),
  after: metricsOf(after),
  flaggedFamilyCount: flagged.length,
  splitCount: flagged.filter((item) => item.actionTaken === "SPLIT").length,
  brands: brandRows,
  marketplaces: marketplaceRows,
  collectableBrandCount: collectable.length,
  specialValidation,
  remainingSuspiciousAfter: remainingAfter,
  flaggedFamilies: flagged,
};

await mkdir(join(ROOT, "data", "registry"), { recursive: true });
const auditPath = join(ROOT, "data", "registry", "model-family-false-merge-audit.json");
const tmp = `${auditPath}.${process.pid}.tmp`;
await writeFile(tmp, JSON.stringify(report, null, 2), "utf-8");
try {
  await unlink(auditPath);
} catch {
  // ignore
}
try {
  await rename(tmp, auditPath);
} catch {
  await writeFile(auditPath, JSON.stringify(report, null, 2), "utf-8");
}

console.log("=== False-merge audit ===");
console.log(`Brands audited: ${collectable.length}`);
console.log(
  `BEFORE families=${report.before.total} multiVariant=${report.before.multiVariant} genericTitle=${report.before.genericTitle} ge10=${report.before.ge10} ge50=${report.before.ge50}`,
);
console.log(
  `AFTER  families=${report.after.total} multiVariant=${report.after.multiVariant} genericTitle=${report.after.genericTitle} ge10=${report.after.ge10} ge50=${report.after.ge50}`,
);
console.log(`Flagged ${flagged.length}; split ${report.splitCount}`);
console.log("ZARA special:", JSON.stringify(specialValidation.zara.map((row) => `${row.name}:${row.familyCount}f/${row.maxVariantCount}max`)));
console.log("PARIS TEXAS special:", JSON.stringify(specialValidation.parisTexas.map((row) => `${row.name}:${row.familyCount}f/${row.maxVariantCount}max`)));
console.log("Report: data/registry/model-family-false-merge-audit.json");
