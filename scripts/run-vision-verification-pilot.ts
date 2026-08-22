import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import "./loadEnv";
import { runVerificationPilot } from "../src/vision/verification/runVerificationPilot";
import type { ModelFamily } from "../src/modelFamily/types";
import type { AnalyzedProduct } from "../src/types/marketAnalysis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_PATH = join(ROOT, "data", "vision", "verification-pilot-report.json");

const forceOffline = process.argv.includes("--offline");

const families = JSON.parse(
  await readFile(join(ROOT, "data/multibrand/model-families.json"), "utf-8"),
) as ModelFamily[];

const products = JSON.parse(
  await readFile(join(ROOT, "data/multibrand/analyzed-products.json"), "utf-8"),
) as AnalyzedProduct[];

console.log(
  `\nRunning vision verification pilot (${forceOffline ? "offline" : "auto"}) on 30 families...`,
);

const report = await runVerificationPilot({
  families,
  products,
  forceOffline,
});

await mkdir(dirname(OUT_PATH), { recursive: true });
await writeFile(OUT_PATH, JSON.stringify(report, null, 2), "utf-8");

console.log("\n=== CAPONE LAB Vision Verification Pilot ===");
console.log(`Mode: ${report.mode}`);
console.log(`Families analyzed: ${report.summary.analyzedModelFamilies}`);
console.log(`Verified features: ${report.summary.verifiedFeatures}`);
console.log(`Rejected old features: ${report.summary.rejectedOldFeatures}`);
console.log(`Uncertain features: ${report.summary.uncertainFeatures}`);
console.log(`Contradictions: ${report.summary.contradictionCount}`);
console.log(`Radar eligible features: ${report.summary.radarEligibleFeatureCount}`);
console.log(`Written: data/vision/verification-pilot-report.json`);
