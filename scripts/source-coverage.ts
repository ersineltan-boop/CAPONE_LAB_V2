import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSourceCoverageReport } from "../src/source/buildCoverageReport";
import type { ModelFamily } from "../src/modelFamily/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = join(ROOT, "data", "registry", "source-coverage-report.json");

async function main() {
  let families: ModelFamily[] = [];
  try {
    families = JSON.parse(
      await readFile(join(ROOT, "data", "multibrand", "model-families.json"), "utf-8"),
    ) as ModelFamily[];
  } catch {
    families = [];
  }

  let collectionReport: Awaited<ReturnType<typeof buildSourceCoverageReport>> | null = null;
  try {
    collectionReport = JSON.parse(
      await readFile(join(ROOT, "data", "multibrand", "collection-report.json"), "utf-8"),
    );
  } catch {
    collectionReport = null;
  }

  const report = buildSourceCoverageReport(families, collectionReport as never);
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");

  console.log("\n=== CAPONE Source Coverage Report ===");
  console.log(`Sources: ${report.entries.length}`);
  for (const entry of report.entries) {
    console.log(
      `- ${entry.sourceName} [${entry.coverageStatus}] · raw ${entry.productsDiscovered} · unique ${entry.uniqueProductsAfterDedupe} · families ${entry.modelFamilyCount} · reported ${entry.sourceReportedProductCount ?? "-"} · new ${entry.verifiedNewProductCount}`,
    );
    if (entry.warnings.length > 0) {
      console.log(`    warnings: ${entry.warnings.join(" | ")}`);
    }
  }
  console.log(`Report: ${REPORT_PATH}`);
}

main();
