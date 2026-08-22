import "./loadEnv.ts";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeProductImage,
  getVisionModel,
  requireApiKey,
} from "../src/vision/openaiVision";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

interface AnalyzedProductRow {
  brand: string;
  productName: string;
  productUrl: string;
  imageUrl: string | null;
}

try {
  const raw = await readFile(
    join(ROOT, "data", "pilot", "analyzed-products.json"),
    "utf-8",
  );
  const products = JSON.parse(raw) as AnalyzedProductRow[];
  const product = products.find((p) => p.imageUrl);

  if (!product?.imageUrl) {
    throw new Error("No product with imageUrl found in analyzed-products.json");
  }

  console.log(`Testing 1 product: ${product.productName} (${product.brand})`);

  const result = await analyzeProductImage(
    product.imageUrl,
    requireApiKey(),
    getVisionModel(),
  );

  console.log("\n=== Vision single-product result ===");
  console.log(
    JSON.stringify(
      {
        productName: product.productName,
        brand: product.brand,
        toeShape: result.vision.toeShape,
        heelType: result.vision.heelType,
        details: result.vision.details,
        construction: result.vision.construction,
        surfaceEffects: result.vision.surfaceEffects,
        usage: result.usage,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nVision single-product test failed: ${message}`);
  process.exit(1);
}
