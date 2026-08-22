import "./loadEnv.ts";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { detectConflicts } from "../src/vision/compareWithText";
import {
  analyzeProductImage,
  emptyUsage,
  getVisionModel,
  mergeUsage,
  requireApiKey,
  sleep,
} from "../src/vision/openaiVision";
import {
  isSuccessfulVisionRecord,
  loadVisionFile,
  upsertVisionRecords,
} from "../src/vision/persistVision";
import { selectFiveDiverseProducts } from "../src/vision/selectFiveProducts";
import type { AnalyzedProductInput, VisionProductRecord } from "../src/vision/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const REQUEST_DELAY_MS = 1500;

try {
  const raw = await readFile(
    join(ROOT, "data", "pilot", "analyzed-products.json"),
    "utf-8",
  );
  const products = JSON.parse(raw) as AnalyzedProductInput[];
  const selected = selectFiveDiverseProducts(products);

  if (selected.length < 5) {
    throw new Error(`Expected 5 diverse products, found ${selected.length}`);
  }

  const existingVision = await loadVisionFile();
  const existingByUrl = new Map(
    (existingVision?.products ?? []).map((r) => [r.productUrl, r]),
  );

  const apiKey = requireApiKey();
  const model = getVisionModel();
  let usage = emptyUsage();
  const saved: VisionProductRecord[] = [];

  console.log(`Running vision test on ${selected.length} diverse products...\n`);

  for (const product of selected) {
    if (!product.imageUrl) continue;

    const existing = existingByUrl.get(product.productUrl);
    if (isSuccessfulVisionRecord(existing)) {
      console.log(`Skipping (already analyzed): ${product.productName}`);
      saved.push(existing!);
      continue;
    }

    const result = await analyzeProductImage(product.imageUrl, apiKey, model);
    usage = mergeUsage(usage, result.usage);
    const conflicts = detectConflicts(product, result.vision);

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

    saved.push(record);
    await upsertVisionRecords([record]);

    console.log("---");
    console.log(
      JSON.stringify(
        {
          brand: product.brand,
          productName: product.productName,
          category: product.category,
          toeShape: result.vision.toeShape,
          heelType: result.vision.heelType,
          details: result.vision.details,
          construction: result.vision.construction,
          surfaceEffects: result.vision.surfaceEffects,
          textConflicts: conflicts.map((c) => ({
            field: c.field,
            textValue: c.textValue,
            visionValue: c.visionValue,
            visionConfidence: c.visionConfidence,
          })),
        },
        null,
        2,
      ),
    );

    await sleep(REQUEST_DELAY_MS);
  }

  console.log("\n=== API usage (this run) ===");
  console.log(
    JSON.stringify(
      {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      },
      null,
      2,
    ),
  );
  console.log(`\nPersisted ${saved.filter((r) => !r.error).length} vision records.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nVision five-product test failed: ${message}`);
  process.exit(1);
}
