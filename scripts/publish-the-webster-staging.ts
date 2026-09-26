import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { PilotProduct } from "../src/collector/types";
import {
  extractTheWebsterVendorColor,
  THE_WEBSTER_ID,
  type TheWebsterCoverage,
} from "../src/collector/theWebster";
import { isTheWebsterExcludedBrand } from "../src/collector/theWebster";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stagingDirectory = join(
  root,
  "data",
  "onboarding",
  "staging",
  "marketplaces",
  THE_WEBSTER_ID,
);
const productsPath = join(root, "data", "multibrand", "products.json");

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function normalizedProduct(product: PilotProduct): PilotProduct {
  const color =
    extractTheWebsterVendorColor(product.material ?? undefined) ??
    (/^(?:(?:UK|US|EU|IT|FR)\s*)?\d/i.test(product.color ?? "") ? null : product.color);
  return { ...product, source: THE_WEBSTER_ID, color };
}

const report = await readJson<TheWebsterCoverage>(join(stagingDirectory, "last-good-report.json"));
const staging = (await readJson<PilotProduct[]>(join(stagingDirectory, "catalog.json"))).map(
  normalizedProduct,
);

const failures: string[] = [];
if (report.status !== "FULL") failures.push(`status=${report.status}`);
if (report.coverage !== 1) failures.push(`coverage=${report.coverage}`);
if (report.missing !== 0) failures.push(`missing=${report.missing}`);
if (report.collected !== staging.length) {
  failures.push(`report=${report.collected}, catalog=${staging.length}`);
}
if (staging.some((product) => product.source !== THE_WEBSTER_ID)) {
  failures.push("catalog contains another source");
}
if (staging.some((product) => isTheWebsterExcludedBrand(product.brand))) {
  failures.push("catalog contains an excluded brand");
}
if (staging.some((product) => !product.imageUrl || (product.images?.length ?? 0) === 0)) {
  failures.push("catalog contains a product without source images");
}
if (failures.length > 0) {
  throw new Error(`The Webster publish blocked: ${failures.join("; ")}`);
}

const existing = await readJson<PilotProduct[]>(productsPath);
const previous = existing.filter((product) => product.source === THE_WEBSTER_ID);
const next = [
  ...existing.filter((product) => product.source !== THE_WEBSTER_ID),
  ...staging,
];

await atomicWriteJson(productsPath, next);
await atomicWriteJson(
  join(root, "data", "multibrand", "the-webster-coverage.json"),
  report,
);

console.log(
  JSON.stringify(
    {
      source: THE_WEBSTER_ID,
      previous: previous.length,
      published: staging.length,
      totalProducts: next.length,
      coverage: report.coverage,
      missing: report.missing,
    },
    null,
    2,
  ),
);
