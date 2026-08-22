import { runMultibrandCollection } from "../src/collector/runMultibrand";

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));

try {
  const report = await runMultibrandCollection({
    mode: "full",
    brandIds: requested.length > 0 ? requested : undefined,
  });

  console.log("\n=== CAPONE selected brand collection ===");
  console.log(`Total unique products: ${report.totalProducts}`);
  console.log(`Successful: ${report.successfulBrands.join(", ") || "(none)"}`);
  if (report.failedBrands.length > 0) {
    console.log("Failed (prior products preserved):");
    for (const source of report.sources.filter((item) => item.status === "failed")) {
      console.log(`  - ${source.source}: ${source.errors.join("; ")}`);
    }
  }
  for (const source of report.sources) {
    console.log(
      `  ${source.source}: ${source.parsedProducts} products · reported ${source.sourceReportedProductCount ?? "-"} · exhausted ${source.paginationExhausted ?? "-"} · crawlCap ${source.hitCollectionCrawlCap ?? false}`,
    );
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Selected brand collection aborted: ${message}`);
  process.exit(1);
}
