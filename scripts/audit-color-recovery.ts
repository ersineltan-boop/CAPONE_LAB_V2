import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isGenericModelTitle } from "../src/modelFamily/genericModelTitle";
import type { ModelFamily } from "../src/modelFamily/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FAMILIES_DIR = join(ROOT, "data", "multibrand", "model-families");
const PRODUCTS_PATH = join(ROOT, "data", "multibrand", "products.json");
const ANALYZED_PATH = join(ROOT, "data", "multibrand", "analyzed-products.json");
const BEFORE_PATH = join(ROOT, "data", "registry", "model-family-before-snapshot.json");
const AFTER_PATH = join(ROOT, "data", "registry", "model-family-false-merge-audit.json");
const OUT_PATH = join(ROOT, "data", "registry", "model-family-color-recovery.json");
const CATALOG_DIR = join(ROOT, "public", "data", "catalog");

function colorCount(family: ModelFamily): number {
  const colors = new Set(
    family.variants
      .map((variant) => variant.color?.trim().toLowerCase())
      .filter((color): color is string => Boolean(color)),
  );
  if (colors.size > 0) return colors.size;
  return family.variantCount;
}

function bucket(count: number): string {
  if (count <= 1) return "1";
  if (count === 2) return "2";
  if (count === 3) return "3";
  if (count <= 5) return "4-5";
  if (count <= 9) return "6-9";
  return "10+";
}

async function fileMb(path: string): Promise<number> {
  try {
    const info = await stat(path);
    return Math.round((info.size / (1024 * 1024)) * 100) / 100;
  } catch {
    return 0;
  }
}

async function largestInDir(dir: string, pattern: RegExp): Promise<{ file: string; mb: number }> {
  let largest = { file: "", mb: 0 };
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !pattern.test(entry.name)) continue;
      const mb = await fileMb(join(dir, entry.name));
      if (mb > largest.mb) largest = { file: join(dir, entry.name).replace(`${ROOT}\\`, "").replace(`${ROOT}/`, ""), mb };
    }
  } catch {
    // missing dir
  }
  return largest;
}

const families: ModelFamily[] = [];
const manifest = JSON.parse(await readFile(join(FAMILIES_DIR, "manifest.json"), "utf-8")) as {
  shards: Array<{ file: string; bytes: number }>;
};
for (const shard of manifest.shards) {
  families.push(...(JSON.parse(await readFile(join(FAMILIES_DIR, shard.file), "utf-8")) as ModelFamily[]));
}

const products = JSON.parse(await readFile(PRODUCTS_PATH, "utf-8")) as Array<{ source: string; brand: string }>;
const before = JSON.parse(await readFile(BEFORE_PATH, "utf-8")) as {
  total?: number;
  byBrand?: Record<string, { families?: number }>;
};
const afterAudit = JSON.parse(await readFile(AFTER_PATH, "utf-8")) as {
  after?: { total?: number; multiColor?: number };
  brands?: Array<{ id?: string; brand?: string; after?: number; before?: number; products?: number }>;
};

const byBrand = new Map<
  string,
  { products: number; families: number; multiColor: number; maxColors: number; warnings: string[] }
>();
for (const product of products) {
  const rec = byBrand.get(product.brand) ?? {
    products: 0,
    families: 0,
    multiColor: 0,
    maxColors: 0,
    warnings: [],
  };
  rec.products += 1;
  byBrand.set(product.brand, rec);
}

const distribution = { "1": 0, "2": 0, "3": 0, "4-5": 0, "6-9": 0, "10+": 0 };
const ge10: Array<Record<string, unknown>> = [];
let multiVariant = 0;
let multiColor = 0;
let suspicious = 0;

for (const family of families) {
  const rec = byBrand.get(family.brand) ?? {
    products: 0,
    families: 0,
    multiColor: 0,
    maxColors: 0,
    warnings: [],
  };
  rec.families += 1;
  const colors = colorCount(family);
  if (family.variantCount > 1) multiVariant += 1;
  if (colors > 1) {
    multiColor += 1;
    rec.multiColor += 1;
  }
  rec.maxColors = Math.max(rec.maxColors, colors);
  if (isGenericModelTitle(family.canonicalName) && colors >= 8) {
    rec.warnings.push(`${family.canonicalName} ${colors} colors`);
  }
  if (family.groupingReason.includes("suspicious-style-conflict")) {
    suspicious += 1;
    rec.warnings.push(`suspicious ${family.modelFamilyId}`);
  }
  byBrand.set(family.brand, rec);
  distribution[bucket(colors) as keyof typeof distribution] += 1;
  if (colors >= 10) {
    ge10.push({
      brand: family.brand,
      family: family.canonicalName,
      modelFamilyId: family.modelFamilyId,
      colors,
      variantCount: family.variantCount,
      styleIdentity: family.variants.find((variant) => variant.styleCode)?.styleCode ?? null,
      groupingReason: family.groupingReason,
      provenSameModel: family.groupingReason.startsWith("styleCode:") || family.groupingConfidence === "HIGH",
    });
  }
}

const zara = families.filter((family) => family.brand === "ZARA");
const pt = families.filter((family) => family.brand === "PARIS TEXAS");
const zaraExamples = zara
  .filter((family) => colorCount(family) > 1)
  .sort((a, b) => colorCount(b) - colorCount(a))
  .slice(0, 12)
  .map((family) => ({
    styleId: family.variants.find((variant) => variant.styleCode)?.styleCode ?? family.modelFamilyId,
    colorProductIds: family.variants.map((variant) => variant.productId),
    colorNames: family.variants.map((variant) => variant.color),
    modelFamilyId: family.modelFamilyId,
    canonicalName: family.canonicalName,
    colors: colorCount(family),
  }));
const ptExamples = pt
  .filter((family) => colorCount(family) > 1)
  .sort((a, b) => colorCount(b) - colorCount(a))
  .slice(0, 12)
  .map((family) => ({
    styleId: family.variants.find((variant) => variant.styleCode)?.styleCode ?? family.modelFamilyId,
    colorProductIds: family.variants.map((variant) => variant.productId),
    colorNames: family.variants.map((variant) => variant.color),
    modelFamilyId: family.modelFamilyId,
    canonicalName: family.canonicalName,
    colors: colorCount(family),
  }));

const shardBytes = manifest.shards.map((shard) => shard.bytes);
const largestFamilyShard = Math.max(0, ...shardBytes);
const catalogLargest = await largestInDir(join(CATALOG_DIR, "brands"), /\.json$/);
const visualLargest = await largestInDir(join(CATALOG_DIR, "visual"), /\.json$/);

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    sourceProducts: products.length,
    familiesFinal: families.length,
    familiesBefore: before.total ?? null,
    familiesCurrentOverSplit: afterAudit.after?.total ?? 12941,
    multiVariant,
    multiColor,
    multiColorCurrent: afterAudit.after?.multiColor ?? 1358,
    suspiciousStyleConflicts: suspicious,
    distribution,
    ge10,
  },
  zara: {
    products: products.filter((product) => product.source.toLowerCase() === "zara").length,
    families: zara.length,
    multiColor: zara.filter((family) => colorCount(family) > 1).length,
    maxColors: Math.max(0, ...zara.map(colorCount)),
    examples: zaraExamples,
  },
  parisTexas: {
    products: products.filter((product) => product.source.toLowerCase() === "paris-texas").length,
    families: pt.length,
    multiColor: pt.filter((family) => colorCount(family) > 1).length,
    maxColors: Math.max(0, ...pt.map(colorCount)),
    examples: ptExamples,
  },
  perBrand: [...byBrand.entries()]
    .map(([brand, rec]) => ({ brand, ...rec }))
    .sort((a, b) => a.brand.localeCompare(b.brand)),
  sizes: {
    productsMb: await fileMb(PRODUCTS_PATH),
    analyzedMb: await fileMb(ANALYZED_PATH),
    familyShardTotalMb: Math.round((shardBytes.reduce((sum, bytes) => sum + bytes, 0) / (1024 * 1024)) * 100) / 100,
    largestFamilyShardMb: Math.round((largestFamilyShard / (1024 * 1024)) * 100) / 100,
    largestFrontendBrandShard: catalogLargest,
    largestVisualShard: visualLargest,
  },
};

await writeFile(OUT_PATH, JSON.stringify(report, null, 2), "utf-8");
console.log(JSON.stringify({
  families: families.length,
  multiColor,
  multiVariant,
  ge10: ge10.length,
  zaraFamilies: zara.length,
  zaraMultiColor: report.zara.multiColor,
  ptFamilies: pt.length,
  ptMultiColor: report.parisTexas.multiColor,
  suspicious,
  sizes: report.sizes,
}, null, 2));
