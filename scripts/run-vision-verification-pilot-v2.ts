import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import "./loadEnv";
import { runVerificationPilotV2 } from "../src/vision/verification/runVerificationPilotV2";
import type { ModelFamily } from "../src/modelFamily/types";
import type { AnalyzedProduct } from "../src/types/marketAnalysis";
import type { VerificationPilotReport } from "../src/vision/verification/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_PATH = join(ROOT, "data", "vision", "verification-pilot-v2-report.json");
const V1_REPORT_PATH = join(ROOT, "data", "vision", "verification-pilot-report.json");

const forceOffline = process.argv.includes("--offline");

const families = JSON.parse(
  await readFile(join(ROOT, "data/multibrand/model-families.json"), "utf-8"),
) as ModelFamily[];

const products = JSON.parse(
  await readFile(join(ROOT, "data/multibrand/analyzed-products.json"), "utf-8"),
) as AnalyzedProduct[];

let v1LiveReport: VerificationPilotReport | null = null;
let lockedModelFamilyIds: string[] = [];

try {
  v1LiveReport = JSON.parse(
    await readFile(V1_REPORT_PATH, "utf-8"),
  ) as VerificationPilotReport;
  lockedModelFamilyIds = v1LiveReport.products.map((product) => product.modelFamilyId);
} catch {
  console.warn("V1 pilot report not found — falling back to dynamic selection order");
}

if (lockedModelFamilyIds.length === 0) {
  const { selectVerificationPilotFamilies } = await import(
    "../src/vision/verification/selectPilotFamilies"
  );
  lockedModelFamilyIds = selectVerificationPilotFamilies({
    families,
    products,
  }).map((candidate) => candidate.modelFamilyId);
}

console.log(
  `\nRunning vision verification V2 pilot (${forceOffline ? "offline" : "auto"}) on ${lockedModelFamilyIds.length} locked families...`,
);

const report = await runVerificationPilotV2({
  families,
  products,
  lockedModelFamilyIds,
  v1LiveReport,
  forceOffline,
});

await mkdir(dirname(OUT_PATH), { recursive: true });
await writeFile(OUT_PATH, JSON.stringify(report, null, 2), "utf-8");

console.log("\n=== CAPONE LAB Vision Verification V2 Pilot ===");
console.log(`Mode: ${report.mode}`);
console.log(`Families analyzed: ${report.summary.analyzedModelFamilies}`);
console.log(`Verified features: ${report.summary.verifiedFeatures}`);
console.log(`Rejected old features: ${report.summary.rejectedOldFeatures}`);
console.log(`Uncertain features: ${report.summary.uncertainFeatures}`);
console.log(`Contradictions: ${report.summary.contradictionCount}`);
console.log(`Radar eligible features: ${report.summary.radarEligibleFeatureCount}`);
console.log(
  `Radar eligible critical strap features: ${report.summary.radarEligibleCriticalStrapFeatureCount}`,
);
console.log(`Multi-strap products: ${report.summary.multiStrapProductCount}`);
console.log(`Manual audit products: ${report.summary.manualAuditProductCount}`);
console.log(`Ankle strap YES count: ${report.ankleStrapAudit.length}`);
if (report.apiFailures?.length) {
  console.log(`API failures: ${report.apiFailures.length}`);
  for (const failure of report.apiFailures) {
    console.log(`  - ${failure}`);
  }
}
console.log(`Written: data/vision/verification-pilot-v2-report.json`);
