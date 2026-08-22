import { runPilotAnalysis } from "../src/analysis/runAnalysis";

const report = await runPilotAnalysis();

console.log("\n=== CAPONE LAB Pilot Market Analysis ===");
console.log(`Analyzed products: ${report.totalProducts}`);
console.log(`Unknown colorFamily: ${report.unknownCounts.colorFamily}`);
console.log(`Unknown materialFamily: ${report.unknownCounts.materialFamily}`);
console.log(`Unknown heelType: ${report.unknownCounts.heelType}`);
console.log(`Unknown heelHeightGroup: ${report.unknownCounts.heelHeightGroup}`);
console.log(`Unknown toeShape: ${report.unknownCounts.toeShape}`);
console.log("\nTop signals:");
for (const signal of report.topSignals) {
  console.log(`  ${signal.tag}: ${signal.productCount} products, ${signal.brandCount} brands`);
}
