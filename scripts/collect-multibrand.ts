import { runMultibrandCollection } from "../src/collector/runMultibrand";
import { runMultibrandAnalysis } from "../src/analysis/runMultibrandAnalysis";
import { runSnapshotPipeline } from "../src/history/runSnapshot";

try {
  const report = await runMultibrandCollection();
  await runMultibrandAnalysis();
  const { snapshot, changeReport } = await runSnapshotPipeline();

  const successfulSources = report.sources.filter(
    (source) => source.status === "success" || source.status === "partial",
  );
  const failedSources = report.sources.filter((source) => source.status === "failed");
  const newBrandReports = report.sources.filter(
    (source) => source.method !== "pilot-cache",
  );
  const newBrandSuccess = newBrandReports.filter(
    (source) => source.parsedProducts > 0,
  ).length;

  console.log("\n=== CAPONE LAB Multibrand Collection ===");
  console.log(`Total unique products: ${report.totalProducts}`);
  console.log(`Successful sources: ${successfulSources.length}/${report.sources.length}`);
  console.log(`New brand successes: ${newBrandSuccess}/${newBrandReports.length}`);
  console.log(`Failed sources: ${failedSources.length}`);
  console.log(`Snapshot: data/history/${snapshot.snapshotId}`);
  console.log(`comparisonAvailable: ${changeReport.comparisonAvailable}`);

  if (failedSources.length > 0) {
    console.log("\nFailed:");
    for (const source of failedSources) {
      console.log(`  - ${source.source}: ${source.errors.join("; ")}`);
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nMultibrand collection aborted: ${message}`);
  process.exit(1);
}
