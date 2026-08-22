import { runSnapshotCompareOnly } from "../src/history/runSnapshot";

try {
  const report = await runSnapshotCompareOnly();

  console.log("\n=== CAPONE LAB Snapshot Compare ===");
  console.log(`comparisonAvailable: ${report.comparisonAvailable}`);
  console.log(`currentSnapshotId: ${report.currentSnapshotId ?? "none"}`);
  console.log(`previousSnapshotId: ${report.previousSnapshotId ?? "none"}`);
  console.log(`signalChanges: ${report.signalChanges.length}`);
  console.log(`newProducts: ${report.newProducts.length}`);
  console.log(`removedProducts: ${report.removedProducts.length}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nSnapshot compare failed: ${message}`);
  process.exit(1);
}
