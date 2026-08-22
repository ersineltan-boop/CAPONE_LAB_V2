import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runBrandOnboarding } from "../src/onboarding/runOnboarding";

process.on("uncaughtException", (error) => {
  console.error("onboarding uncaughtException (continuing):", error instanceof Error ? error.message : error);
});
process.on("unhandledRejection", (error) => {
  console.error("onboarding unhandledRejection (continuing):", error instanceof Error ? error.message : error);
});

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const dryRun = process.argv.includes("--dry-run");
const limitRaw = argValue("--limit");
const onlyRaw = argValue("--only");

const result = await runBrandOnboarding(ROOT, {
  dryRun,
  limit: limitRaw ? Number(limitRaw) : undefined,
  only: onlyRaw ? onlyRaw.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
});

console.log("=== CAPONE brand onboarding ===");
console.log(`dry-run: ${dryRun ? "yes" : "no"}`);
console.log(`attempted: ${result.attempted.join(", ") || "(none)"}`);
console.log(`activated: ${result.activated.join(", ") || "(none)"}`);
console.log(`active brands: ${result.report.summary.activeBrandsBefore} → ${result.report.summary.activeBrandsAfter}`);
console.log(`blocked: ${result.report.summary.blocked}`);
console.log(`custom adapter required: ${result.report.summary.customAdapterRequired}`);
console.log(`failed: ${result.report.summary.failed}`);
console.log(`storage: ${result.report.summary.storageStatus}`);
console.log("report: data/registry/brand-onboarding-report.json");
for (const attempt of result.report.attempts) {
  console.log(
    `- ${attempt.brand}: ${attempt.status} / ${attempt.detectedPlatform ?? "n/a"} / products ${attempt.productsFound}${attempt.blocker ? ` / ${attempt.blocker}` : ""}`,
  );
}
