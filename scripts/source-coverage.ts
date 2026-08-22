import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSourceCoverageReport } from "../src/source/buildCoverageReport";
import { loadModelFamilies } from "../src/modelFamily/dataset";
import type { PilotProduct } from "../src/collector/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = join(ROOT, "data", "registry", "source-coverage-report.json");

const STATUS_ORDER: Record<string, number> = {
  FAILED: 0,
  PARTIAL: 1,
  NEEDS_PROBE: 2,
  NEEDS_CUSTOM_ADAPTER: 3,
  FULL: 4,
};

async function main() {
  const families = await loadModelFamilies();

  let products: PilotProduct[] = [];
  try {
    products = JSON.parse(
      await readFile(join(ROOT, "data", "multibrand", "products.json"), "utf-8"),
    ) as PilotProduct[];
  } catch {
    products = [];
  }

  let collectionReport: Awaited<ReturnType<typeof buildSourceCoverageReport>> | null = null;
  try {
    collectionReport = JSON.parse(
      await readFile(join(ROOT, "data", "multibrand", "collection-report.json"), "utf-8"),
    );
  } catch {
    collectionReport = null;
  }

  const report = buildSourceCoverageReport(families, collectionReport as never, products);
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");

  const sorted = [...report.entries].sort(
    (a, b) =>
      (STATUS_ORDER[a.coverageStatus] ?? 9) - (STATUS_ORDER[b.coverageStatus] ?? 9) ||
      a.sourceName.localeCompare(b.sourceName),
  );

  console.log("\n=== CAPONE Source Coverage Report ===");
  console.log(`Sources: ${report.entries.length}`);
  for (const entry of sorted) {
    console.log(
      `- ${entry.sourceName} [${entry.coverageStatus}] · collected ${entry.collectedProductCount} · families ${entry.modelFamilyCount} · expected ${entry.observedExpectedProductCount ?? "-"} · coverage ${entry.estimatedCoveragePercent ?? "-"}% · new ${entry.verifiedNewCount}`,
    );
    if (entry.limitations.length > 0) {
      console.log(`    limitations: ${entry.limitations.join(" | ")}`);
    }
  }
  console.log(`Report: ${REPORT_PATH}`);
}

main();
