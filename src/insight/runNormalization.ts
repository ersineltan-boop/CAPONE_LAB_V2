import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnalyzedProduct } from "../types/marketAnalysis";
import type { VisionAnalysisFile } from "../vision/types";
import { buildNormalizedSummary } from "./buildNormalizedSummary";
import { mergeAllProductInsights } from "./mergeProductInsight";
import type { NormalizedProductInsight, NormalizedSummary } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const PILOT_DIR = join(ROOT, "data", "pilot");

export interface NormalizationRunReport {
  totalProducts: number;
  textAnalyzedProducts: number;
  visionAnalyzedProducts: number;
  fullHybridProducts: number;
  outputPath: string;
  summaryPath: string;
}

export async function runNormalization(): Promise<{
  products: NormalizedProductInsight[];
  summary: NormalizedSummary;
  report: NormalizationRunReport;
}> {
  const analyzedRaw = await readFile(
    join(PILOT_DIR, "analyzed-products.json"),
    "utf-8",
  );
  const textProducts = JSON.parse(analyzedRaw) as AnalyzedProduct[];

  let visionRecords: VisionAnalysisFile["products"] = [];
  try {
    const visionRaw = await readFile(
      join(PILOT_DIR, "vision-analysis.json"),
      "utf-8",
    );
    const visionFile = JSON.parse(visionRaw) as VisionAnalysisFile;
    visionRecords = visionFile.products ?? [];
  } catch {
    visionRecords = [];
  }

  const products = mergeAllProductInsights(textProducts, visionRecords);
  const summary = buildNormalizedSummary(products);

  await mkdir(PILOT_DIR, { recursive: true });
  const outputPath = join(PILOT_DIR, "normalized-products.json");
  const summaryPath = join(PILOT_DIR, "normalized-summary.json");

  await writeFile(outputPath, JSON.stringify(products, null, 2), "utf-8");
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf-8");

  return {
    products,
    summary,
    report: {
      totalProducts: products.length,
      textAnalyzedProducts: summary.textAnalyzedProducts,
      visionAnalyzedProducts: summary.visionAnalyzedProducts,
      fullHybridProducts: summary.fullHybridProducts,
      outputPath,
      summaryPath,
    },
  };
}
