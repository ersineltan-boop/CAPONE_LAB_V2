import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ModelFamily, RawAnalyzedProduct } from "../src/modelFamily/types";
import {
  buildTaxonomyQaReport,
  buildTaxonomyQaSamples,
  DISTRIBUTION_FIELDS,
  summarizeField,
} from "../src/taxonomy/qaReport";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MULTIBRAND_DIR = join(ROOT, "data", "multibrand");
const FAMILIES_PATH = join(MULTIBRAND_DIR, "model-families.json");
const PRODUCTS_PATH = join(MULTIBRAND_DIR, "analyzed-products.json");
const REPORT_PATH = join(MULTIBRAND_DIR, "taxonomy-qa-report.json");
const SAMPLES_PATH = join(MULTIBRAND_DIR, "taxonomy-qa-samples.json");

const families = JSON.parse(await readFile(FAMILIES_PATH, "utf-8")) as ModelFamily[];
let products: RawAnalyzedProduct[] = [];
try {
  products = JSON.parse(await readFile(PRODUCTS_PATH, "utf-8")) as RawAnalyzedProduct[];
} catch {
  products = [];
}

const productsByUrl = new Map(products.map((product) => [product.productUrl, product]));
const report = buildTaxonomyQaReport(families);
const samples = buildTaxonomyQaSamples(families, productsByUrl, 3);

await mkdir(MULTIBRAND_DIR, { recursive: true });
await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");
await writeFile(SAMPLES_PATH, JSON.stringify(samples, null, 2), "utf-8");

console.log("\n=== CAPONE Footwear Taxonomy QA ===");
console.log(`Total Model Families: ${report.totalFamilies}`);
console.log("\nCategory provenance:");
console.log(`  PRODUCT_EVIDENCE: ${report.categoryProvenance.PRODUCT_EVIDENCE}`);
console.log(`  LEGACY_CATEGORY: ${report.categoryProvenance.LEGACY_CATEGORY}`);
console.log(`  INSUFFICIENT (UNCLASSIFIED): ${report.categoryProvenance.INSUFFICIENT}`);
console.log(`  UNCLASSIFIED families: ${report.unclassifiedCount}`);

console.log("\nMajor field status:");
for (const field of report.fields.filter((entry) => entry.field.startsWith("global."))) {
  console.log(`  ${field.field}: ${summarizeField(field)}`);
}

console.log("\nValue distributions:");
for (const key of DISTRIBUTION_FIELDS) {
  const dist = report.valueDistributions[key];
  const parts = Object.entries(dist)
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => `${value} ${count}`)
    .join(" · ");
  console.log(`  ${key}: ${parts || "(empty)"}`);
}

console.log("\nNew Arrivals date sanity:");
console.log(`  Earliest: ${report.newArrivalsDates.earliestModelFamilyFirstSeenAt ?? "n/a"}`);
console.log(`  Latest: ${report.newArrivalsDates.latestModelFamilyFirstSeenAt ?? "n/a"}`);
console.log(`  Last 24H: ${report.newArrivalsDates.countLast24H}`);
console.log(`  Last 7D: ${report.newArrivalsDates.countLast7D}`);
console.log(`  Last 30D: ${report.newArrivalsDates.countLast30D}`);
console.log(`  Last 90D: ${report.newArrivalsDates.countLast90D}`);
console.log("  Top bulk dates:");
for (const entry of report.newArrivalsDates.bulkBackfillDates.slice(0, 5)) {
  console.log(`    ${entry.date}: ${entry.count} (${entry.sharePercent}%)`);
}

if (report.suspiciousPatterns.length > 0) {
  console.log("\nSuspicious patterns:");
  for (const pattern of report.suspiciousPatterns.slice(0, 20)) {
    console.log(`  - ${pattern}`);
  }
} else {
  console.log("\nSuspicious patterns: none flagged");
}

console.log(`\nReport: ${REPORT_PATH}`);
console.log(`Samples: ${SAMPLES_PATH}`);
