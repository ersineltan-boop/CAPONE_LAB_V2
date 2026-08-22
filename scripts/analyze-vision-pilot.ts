import "./loadEnv.ts";
import { runVisionPilot } from "../src/vision/runVisionPilot";

try {
  const report = await runVisionPilot();

  console.log("\n=== CAPONE LAB Vision Analysis Pilot ===");
  console.log(`Model: ${report.model}`);
  console.log(`Analyzed products: ${report.analyzedProducts}/${report.selectedProducts}`);
  console.log(`Skipped existing: ${report.skippedExisting}`);
  console.log(`Failed: ${report.failedProducts}`);
  console.log(
    `ToeShape UNKNOWN: ${report.toeShapeUnknownBefore} → ${report.toeShapeUnknownAfter}`,
  );
  console.log(`Newly filled toeShape: ${report.newlyFilledToeShape}`);
  console.log(`Text conflicts: ${report.conflictsWithText.length}`);
  console.log(
    `Low-confidence items: ${report.lowConfidenceResults.length}`,
  );
  console.log(
    `Usage: input=${report.usage.inputTokens} output=${report.usage.outputTokens} total=${report.usage.totalTokens}`,
  );

  if (report.apiErrors.length > 0) {
    console.log("\nAPI errors:");
    for (const err of report.apiErrors) {
      console.log(`  - ${err}`);
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nVision pilot aborted: ${message}`);
  process.exit(1);
}
