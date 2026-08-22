import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import "./loadEnv";
import { runVerificationStabilityTest } from "../src/vision/verification/runVerificationStabilityTest";
import type { ModelFamily } from "../src/modelFamily/types";
import type { AnalyzedProduct } from "../src/types/marketAnalysis";
import type { VerificationPilotReport } from "../src/vision/verification/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_PATH = join(ROOT, "data", "vision", "verification-stability-report.json");
const V1_REPORT_PATH = join(ROOT, "data", "vision", "verification-pilot-report.json");

const forceOffline = process.argv.includes("--offline");

const families = JSON.parse(
  await readFile(join(ROOT, "data/multibrand/model-families.json"), "utf-8"),
) as ModelFamily[];

const products = JSON.parse(
  await readFile(join(ROOT, "data/multibrand/analyzed-products.json"), "utf-8"),
) as AnalyzedProduct[];

let lockedModelFamilyIds: string[] = [];

try {
  const v1Report = JSON.parse(
    await readFile(V1_REPORT_PATH, "utf-8"),
  ) as VerificationPilotReport;
  lockedModelFamilyIds = v1Report.products.map((product) => product.modelFamilyId);
} catch {
  console.warn("V1 pilot report not found — falling back to dynamic selection");
  const { selectVerificationPilotFamilies } = await import(
    "../src/vision/verification/selectPilotFamilies"
  );
  lockedModelFamilyIds = selectVerificationPilotFamilies({
    families,
    products,
  }).map((candidate) => candidate.modelFamilyId);
}

console.log(
  `\nRunning vision stability test (${forceOffline ? "offline" : "live"}) — 3 passes x ${lockedModelFamilyIds.length} families...`,
);

const report = await runVerificationStabilityTest({
  families,
  products,
  lockedModelFamilyIds,
  forceOffline,
});

await mkdir(dirname(OUT_PATH), { recursive: true });
await writeFile(OUT_PATH, JSON.stringify(report, null, 2), "utf-8");

console.log("\n=== CAPONE LAB Vision Stability Test ===");
console.log(`Mode: ${report.mode}`);
console.log(`All runs fully completed: ${report.allRunsFullyCompleted}`);
console.log(`Total observations: ${report.summary.totalCriticalFeatureObservations}`);
console.log(`STABLE_YES: ${report.summary.stableYes}`);
console.log(`STABLE_NO: ${report.summary.stableNo}`);
console.log(`UNSTABLE: ${report.summary.unstable}`);
console.log(`3/3 stable Radar-eligible: ${report.summary.stableRadarEligible}`);
if (report.apiFailures.length) {
  console.log(`API failures: ${report.apiFailures.length}`);
}
console.log(`Written: data/vision/verification-stability-report.json`);
