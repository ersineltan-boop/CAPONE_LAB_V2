import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProducts } from "./analyzeProduct";
import { buildMarketAnalysis } from "./buildMarketAnalysis";
import type { PilotProductRaw } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const PILOT_DIR = join(ROOT, "data", "pilot");

export interface AnalysisRunReport {
  runStartedAt: string;
  runFinishedAt: string;
  totalProducts: number;
  unknownCounts: {
    colorFamily: number;
    materialFamily: number;
    heelType: number;
    heelHeightGroup: number;
    toeShape: number;
  };
  topSignals: { tag: string; productCount: number; brandCount: number }[];
}

export async function runPilotAnalysis(): Promise<AnalysisRunReport> {
  const productsPath = join(PILOT_DIR, "products.json");
  const raw = await readFile(productsPath, "utf-8");
  const rawProducts = JSON.parse(raw) as PilotProductRaw[];

  const runStartedAt = new Date().toISOString();
  const analyzed = analyzeProducts(rawProducts);
  const marketAnalysis = buildMarketAnalysis(analyzed);
  const runFinishedAt = new Date().toISOString();

  await mkdir(PILOT_DIR, { recursive: true });
  await writeFile(
    join(PILOT_DIR, "analyzed-products.json"),
    JSON.stringify(analyzed, null, 2),
    "utf-8",
  );
  await writeFile(
    join(PILOT_DIR, "market-analysis.json"),
    JSON.stringify(marketAnalysis, null, 2),
    "utf-8",
  );

  return {
    runStartedAt,
    runFinishedAt,
    totalProducts: analyzed.length,
    unknownCounts: marketAnalysis.unknownCounts,
    topSignals: marketAnalysis.topSignals.slice(0, 5).map((s) => ({
      tag: s.tag,
      productCount: s.productCount,
      brandCount: s.brandCount,
    })),
  };
}
