import { runMultibrandAnalysis } from "../src/analysis/runMultibrandAnalysis";

const report = await runMultibrandAnalysis();

console.log("\n=== CAPONE LAB Multibrand Market Analysis ===");
console.log(`Analyzed products: ${report.totalProducts}`);
console.log(`Unknown colorFamily: ${report.unknownCounts.colorFamily}`);
console.log(`Unknown materialFamily: ${report.unknownCounts.materialFamily}`);
console.log(`Unknown heelType: ${report.unknownCounts.heelType}`);
console.log(`Unknown heelHeightGroup: ${report.unknownCounts.heelHeightGroup}`);
console.log(`Unknown toeShape: ${report.unknownCounts.toeShape}`);
