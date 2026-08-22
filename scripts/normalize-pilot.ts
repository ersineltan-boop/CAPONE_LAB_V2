import { runNormalization } from "../src/insight/runNormalization";

const { report, summary } = await runNormalization();

console.log("\n=== CAPONE LAB Normalized Product Insight ===");
console.log(`Products: ${report.totalProducts}`);
console.log(`Text analyzed: ${report.textAnalyzedProducts}`);
console.log(`Vision analyzed: ${report.visionAnalyzedProducts}`);
console.log(`Full hybrid: ${report.fullHybridProducts}`);
console.log(`Written: ${report.outputPath}`);
console.log(`Summary: ${report.summaryPath}`);
console.log("\nTop details (with provenance):");
for (const item of summary.topDetails.slice(0, 3)) {
  console.log(
    `  ${item.tag}: ${item.productCount} total (text=${item.textSourced}, vision=${item.visionSourced}, hybrid=${item.hybridProducts})`,
  );
}
