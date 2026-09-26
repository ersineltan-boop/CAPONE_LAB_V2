import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { discoverMarketplaceBrandCandidates } from "../src/onboarding/discovery";
import type { MarketplaceBrandEvidence } from "../src/onboarding/discovery";
import type { BrandUniverseFile } from "../src/registry/build/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const products = JSON.parse(
  await readFile(join(ROOT, "data/multibrand/products.json"), "utf-8"),
) as MarketplaceBrandEvidence[];
const universe = JSON.parse(
  await readFile(join(ROOT, "data/registry/brand-universe.json"), "utf-8"),
) as BrandUniverseFile;
const report = discoverMarketplaceBrandCandidates(products, universe.brands);
const output = join(ROOT, "data/registry/brand-discovery-report.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
console.log(`Brand discovery candidates: ${report.candidates.length}`);
console.log("Source policy: approved marketplaces only; official source required before activation");
