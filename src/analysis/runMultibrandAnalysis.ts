import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProducts } from "./analyzeProduct";
import { createLegacyProductCatalogStore, type ProductCatalogStore } from "../collector/sourceProductArchive";
import { buildMarketAnalysis } from "./buildMarketAnalysis";
import { loadProductDateEnrichment } from "../productDates/loadEnrichment";
import { mergeProductDatesBatch } from "../productDates/merge";
import type { AnalyzedProduct, PilotProductRaw } from "./types";
import type { AnalysisRunReport } from "./runAnalysis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const MULTIBRAND_DIR = join(ROOT, "data", "multibrand");

export async function runMultibrandAnalysis(options: {
  directory?: string;
  catalog?: ProductCatalogStore;
  sourceIds?: ReadonlySet<string>;
} = {}): Promise<AnalysisRunReport> {
  const directory = options.directory ?? MULTIBRAND_DIR;
  const catalog = options.catalog ?? createLegacyProductCatalogStore(directory);
  const rawProducts = await catalog.read<PilotProductRaw>("products");
  const dateEnrichment = await loadProductDateEnrichment(
    join(directory, "product-date-enrichment.json"),
  );
  const selectedProducts = options.sourceIds ? rawProducts.filter(row => options.sourceIds!.has(row.source)) : rawProducts;
  const productsWithDates = mergeProductDatesBatch(selectedProducts, dateEnrichment);

  const runStartedAt = new Date().toISOString();
  const refreshed = analyzeProducts(productsWithDates);
  const analyzed = options.sourceIds
    ? [...(await catalog.read<AnalyzedProduct>("analyzed-products")).filter(row => !options.sourceIds!.has(row.source)), ...refreshed]
    : refreshed;
  const marketAnalysis = buildMarketAnalysis(analyzed);
  const runFinishedAt = new Date().toISOString();

  await mkdir(directory, { recursive: true });
  if (options.sourceIds?.size !== 0) await catalog.write("analyzed-products", analyzed);
  await writeFile(
    join(directory, "market-analysis.json"),
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
