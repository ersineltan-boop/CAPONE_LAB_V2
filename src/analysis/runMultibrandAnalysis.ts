import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProducts } from "./analyzeProduct";
import { buildMarketAnalysis } from "./buildMarketAnalysis";
import { loadProductDateEnrichment } from "../productDates/loadEnrichment";
import { mergeProductDatesBatch } from "../productDates/merge";
import type { PilotProductRaw } from "./types";
import type { AnalysisRunReport } from "./runAnalysis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const MULTIBRAND_DIR = join(ROOT, "data", "multibrand");

export async function runMultibrandAnalysis(): Promise<AnalysisRunReport> {
  const productsPath = join(MULTIBRAND_DIR, "products.json");
  const raw = await readFile(productsPath, "utf-8");
  const rawProducts = JSON.parse(raw) as PilotProductRaw[];
  const dateEnrichment = await loadProductDateEnrichment(
    join(MULTIBRAND_DIR, "product-date-enrichment.json"),
  );
  const productsWithDates = mergeProductDatesBatch(rawProducts, dateEnrichment);

  const runStartedAt = new Date().toISOString();
  const analyzed = analyzeProducts(productsWithDates);
  const marketAnalysis = buildMarketAnalysis(analyzed);
  const runFinishedAt = new Date().toISOString();

  await mkdir(MULTIBRAND_DIR, { recursive: true });
  await writeFile(
    join(MULTIBRAND_DIR, "analyzed-products.json"),
    JSON.stringify(analyzed, null, 2),
    "utf-8",
  );
  await writeFile(
    join(MULTIBRAND_DIR, "market-analysis.json"),
    JSON.stringify(marketAnalysis, null, 2),
    "utf-8",
  );

  return {
    runStartedAt,
    runFinishedAt,
    totalProducts: analyzed.length,
    unknownCounts: marketAnalysis.unknownCounts,
    topSignals: marketAnalysis.topSignals.slice(0, 5).map((signal) => ({
      tag: signal.tag,
      productCount: signal.productCount,
      brandCount: signal.brandCount,
    })),
  };
}
