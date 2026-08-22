import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectLowConfidence,
  detectConflicts,
  isTextToeUnknown,
  isVisionToeKnown,
  newlyDetectedDetailTags,
} from "./compareWithText";
import {
  countUnknownToe,
  productsWithLowConfidence,
  summarizeTags,
} from "./buildReport";
import {
  analyzeProductImage,
  emptyUsage,
  getVisionModel,
  mergeUsage,
  requireApiKey,
  sleep,
} from "./openaiVision";
import {
  isSuccessfulVisionRecord,
  loadVisionFile,
  upsertVisionRecords,
} from "./persistVision";
import { getPilotCohortProducts, selectPilotProducts } from "./selectProducts";
import type {
  AnalyzedProductInput,
  VisionAnalysisReport,
  VisionProductRecord,
} from "./types";
import { BRAND_TARGETS, PRODUCTS_PER_BRAND } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const PILOT_DIR = join(ROOT, "data", "pilot");
const REPORT_FILE = join(PILOT_DIR, "vision-analysis-report.json");
const REQUEST_DELAY_MS = 1500;
const PILOT_TARGET = BRAND_TARGETS.length * PRODUCTS_PER_BRAND;

async function loadAnalyzedProducts(): Promise<AnalyzedProductInput[]> {
  const raw = await readFile(join(PILOT_DIR, "analyzed-products.json"), "utf-8");
  return JSON.parse(raw) as AnalyzedProductInput[];
}

function countUnknownHeel(
  products: AnalyzedProductInput[],
  records: VisionProductRecord[],
): number {
  const recordByUrl = new Map(records.map((record) => [record.productUrl, record]));
  let unknown = 0;

  for (const product of products) {
    const record = recordByUrl.get(product.productUrl);
    if (!record || record.error) continue;
    if (record.vision.heelType.value === "UNKNOWN") unknown += 1;
  }

  return unknown;
}

function buildReport(
  cohort: AnalyzedProductInput[],
  records: VisionProductRecord[],
  runStartedAt: string,
  runFinishedAt: string,
  model: string,
  usage: ReturnType<typeof emptyUsage>,
  apiErrors: string[],
  skippedExisting: number,
  newApiCalls: number,
): VisionAnalysisReport {
  const successful = records.filter((record) => !record.error);
  const cohortUrls = new Set(cohort.map((product) => product.productUrl));
  const cohortRecords = records.filter((record) => cohortUrls.has(record.productUrl));
  const cohortSuccessful = cohortRecords.filter((record) => !record.error);

  const conflicts = cohort.flatMap((product) => {
    const record = records.find((item) => item.productUrl === product.productUrl);
    if (!record || record.error) return [];
    return detectConflicts(product, record.vision);
  });

  const lowConfidence = cohort.flatMap((product) => {
    const record = records.find((item) => item.productUrl === product.productUrl);
    if (!record || record.error) return [];
    return collectLowConfidence(product, record.vision);
  });

  const detailTagMap = new Map<string, { brands: Set<string>; count: number }>();
  for (const product of cohort) {
    const record = records.find((item) => item.productUrl === product.productUrl);
    if (!record || record.error) continue;
    for (const tag of newlyDetectedDetailTags(product, record.vision)) {
      if (!detailTagMap.has(tag)) detailTagMap.set(tag, { brands: new Set(), count: 0 });
      const entry = detailTagMap.get(tag)!;
      entry.count += 1;
      entry.brands.add(product.brand);
    }
  }

  const newlyDetectedDetails = [...detailTagMap.entries()]
    .map(([tag, data]) => ({
      tag,
      productCount: data.count,
      brandCount: data.brands.size,
      brands: [...data.brands].sort(),
    }))
    .sort((a, b) => b.productCount - a.productCount);

  const unknownToe = countUnknownToe(cohort, cohortRecords);
  const newlyFilledToeShape = cohort.filter((product) => {
    const record = records.find((item) => item.productUrl === product.productUrl);
    if (!record || record.error) return false;
    return isTextToeUnknown(product) && isVisionToeKnown(record.vision);
  }).length;

  const topVisualDetails = summarizeTags(cohortSuccessful, (vision) => vision.details);

  return {
    runStartedAt,
    runFinishedAt,
    model,
    selectedProducts: PILOT_TARGET,
    analyzedProducts: cohortSuccessful.length,
    skippedExisting,
    failedProducts: cohortRecords.filter((record) => record.error).length,
    newApiCalls,
    toeShapeUnknownBefore: unknownToe.before,
    toeShapeUnknownAfter: unknownToe.after,
    heelTypeUnknownAfter: countUnknownHeel(cohort, cohortRecords),
    newlyFilledToeShape,
    newlyDetectedDetails,
    conflictsWithText: conflicts,
    lowConfidenceResults: lowConfidence,
    topVisualDetails: topVisualDetails.slice(0, 15),
    topVisualConstructions: summarizeTags(cohortSuccessful, (vision) => vision.construction).slice(
      0,
      15,
    ),
    topVisualSurfaceEffects: summarizeTags(
      cohortSuccessful,
      (vision) => vision.surfaceEffects,
    ).slice(0, 15),
    apiErrors,
    usage,
  };
}

export async function runVisionPilot(): Promise<VisionAnalysisReport> {
  const apiKey = requireApiKey();
  const model = getVisionModel();
  const runStartedAt = new Date().toISOString();

  const allProducts = await loadAnalyzedProducts();
  const existing = await loadVisionFile();
  const existingRecords = existing?.products ?? [];
  const skippedExisting = existingRecords.filter((record) => !record.error).length;

  const toAnalyze = selectPilotProducts(allProducts, existingRecords);
  const maxNewCalls = Math.max(0, PILOT_TARGET - skippedExisting);
  const queue = toAnalyze.slice(0, maxNewCalls);

  let usage = existing?.usage ?? emptyUsage();
  const apiErrors: string[] = [];
  let newApiCalls = 0;

  for (const product of queue) {
    if (!product.imageUrl) continue;

    const existingRecord = existingRecords.find(
      (record) => record.productUrl === product.productUrl,
    );
    if (isSuccessfulVisionRecord(existingRecord)) continue;

    try {
      const result = await analyzeProductImage(product.imageUrl, apiKey, model);
      usage = mergeUsage(usage, result.usage);
      newApiCalls += 1;

      const record: VisionProductRecord = {
        productUrl: product.productUrl,
        brand: product.brand,
        productName: product.productName,
        imageUrl: product.imageUrl,
        model,
        analyzedAt: new Date().toISOString(),
        vision: result.vision,
        usage: result.usage,
      };

      await upsertVisionRecords([record], result.usage);
      const refreshed = await loadVisionFile();
      if (refreshed) {
        existingRecords.length = 0;
        existingRecords.push(...refreshed.products);
        usage = refreshed.usage;
      } else {
        const index = existingRecords.findIndex(
          (item) => item.productUrl === product.productUrl,
        );
        if (index >= 0) existingRecords[index] = record;
        else existingRecords.push(record);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      apiErrors.push(`${product.productUrl}: ${message}`);
      newApiCalls += 1;

      const failedRecord: VisionProductRecord = {
        productUrl: product.productUrl,
        brand: product.brand,
        productName: product.productName,
        imageUrl: product.imageUrl,
        model,
        analyzedAt: new Date().toISOString(),
        vision: {
          toeShape: { value: "UNKNOWN", confidence: 0 },
          heelType: { value: "UNKNOWN", confidence: 0 },
          details: [],
          construction: [],
          surfaceEffects: [],
        },
        error: message,
      };

      await upsertVisionRecords([failedRecord]);
      const refreshed = await loadVisionFile();
      if (refreshed) {
        existingRecords.length = 0;
        existingRecords.push(...refreshed.products);
      }
    }

    await sleep(REQUEST_DELAY_MS);
  }

  const runFinishedAt = new Date().toISOString();
  const finalVision = await loadVisionFile();
  const finalRecords = finalVision?.products ?? existingRecords;
  const cohort = getPilotCohortProducts(allProducts, finalRecords);

  const report = buildReport(
    cohort,
    finalRecords,
    finalVision?.runStartedAt ?? runStartedAt,
    runFinishedAt,
    model,
    finalVision?.usage ?? usage,
    apiErrors,
    skippedExisting,
    newApiCalls,
  );

  await mkdir(PILOT_DIR, { recursive: true });
  await writeFile(REPORT_FILE, JSON.stringify(report, null, 2), "utf-8");

  return report;
}

export function getLowConfidenceProductCount(records: VisionProductRecord[]): number {
  return productsWithLowConfidence(records).size;
}
