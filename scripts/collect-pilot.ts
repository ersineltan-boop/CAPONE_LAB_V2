import { runPilotCollection } from "../src/collector/runPilot";

const report = await runPilotCollection();

console.log("\n=== CAPONE LAB Pilot Collection Report ===");
console.log(`Total products: ${report.totalProducts}`);
for (const source of report.sources) {
  console.log(
    `${source.source}: ${source.status} — ${source.parsedProducts} products, ${source.productsWithImages} with images, ${source.productsWithMaterial} with material`,
  );
  if (source.errors.length > 0) {
    console.log(`  errors: ${source.errors.join("; ")}`);
  }
}
