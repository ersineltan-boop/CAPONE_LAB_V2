import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import "./loadEnv.ts";
import { buildModelFamilies, buildProductLookup } from "../src/modelFamily/buildFamilies";
import { loadModelFamilies } from "../src/modelFamily/dataset";
import type { RawAnalyzedProduct } from "../src/modelFamily/types";
import { runTaxonomyVisionPilot } from "../src/taxonomy/vision/runPilot";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MULTIBRAND_DIR = join(ROOT, "data", "multibrand");

function parseLimit(argv: string[]): number {
  const limitIndex = argv.indexOf("--limit");
  if (limitIndex >= 0) {
    const parsed = Number.parseInt(argv[limitIndex + 1] ?? "40", 10);
    return Number.isFinite(parsed) ? parsed : 40;
  }
  return 40;
}

const limit = parseLimit(process.argv);
const families = await loadModelFamilies();
const products = JSON.parse(
  await readFile(join(MULTIBRAND_DIR, "analyzed-products.json"), "utf-8"),
) as RawAnalyzedProduct[];

const report = await runTaxonomyVisionPilot({
  families,
  productLookup: buildProductLookup(products),
  limit,
});

console.log("\n=== CAPONE Taxonomy Vision Pilot ===");
console.log(`Executed: ${report.executed}`);
if (report.reason) console.log(`Reason: ${report.reason}`);
console.log(`Families analyzed: ${report.familiesAnalyzed}`);
console.log(`Images analyzed: ${report.imagesAnalyzed}`);
console.log(`Cached hits: ${report.cachedHits}`);
console.log(`Live API calls: ${report.liveCalls}`);
console.log(`UNKNOWN fields before: ${report.unknownFieldsBefore}`);
console.log(`Accepted proposals: ${report.acceptedProposals}`);
console.log(`Rejected proposals: ${report.rejectedProposals}`);
console.log(`UNKNOWN fields after: ${report.unknownFieldsAfter}`);
console.log(`Report: ${join(MULTIBRAND_DIR, "taxonomy-vision-pilot-report.json")}`);

if (report.executed) {
  console.log("\nRe-run npm run build:model-families to merge accepted IMAGE taxonomy.");
}
