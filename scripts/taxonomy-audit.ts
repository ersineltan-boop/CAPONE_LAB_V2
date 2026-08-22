import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildTaxonomyCompletenessReport } from "../src/taxonomy/completeness";
import { buildTaxonomyQaReport } from "../src/taxonomy/qaReport";
import { loadModelFamilies } from "../src/modelFamily/dataset";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = join(ROOT, "data", "multibrand", "taxonomy-audit-report.json");

const families = await loadModelFamilies();
const qa = buildTaxonomyQaReport(families);
const report = {
  generatedAt: new Date().toISOString(),
  ...buildTaxonomyCompletenessReport(families),
  categoryProvenance: qa.categoryProvenance,
  unclassifiedByProvenance: qa.categoryProvenance.INSUFFICIENT,
};

await mkdir(dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");

console.log("\n=== CAPONE Footwear Taxonomy Audit ===");
console.log(`Total Model Families: ${report.totalFamilies}`);
console.log(`Category known: ${report.categoryKnownPercent}% (${report.categoryKnownCount})`);
console.log(`UNCLASSIFIED: ${report.unclassifiedCount}`);
console.log(
  `Category provenance — evidence: ${report.categoryProvenance.PRODUCT_EVIDENCE}, legacy: ${report.categoryProvenance.LEGACY_CATEGORY}, insufficient: ${report.categoryProvenance.INSUFFICIENT}`,
);
console.log(`toeShape known/unknown: ${report.toeShapeKnown}/${report.toeShapeUnknown}`);
console.log(
  `backConstruction known/unknown: ${report.backConstructionKnown}/${report.backConstructionUnknown}`,
);
console.log(`heelType known/unknown: ${report.heelTypeKnown}/${report.heelTypeUnknown}`);
console.log(`Critical completeness: ${report.criticalCompletenessPercent}%`);
console.log(`Average feature completeness: ${report.averageFeatureCompletenessPercent}%`);
console.log(`Report: ${REPORT_PATH}`);
