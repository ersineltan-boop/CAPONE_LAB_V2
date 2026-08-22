import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { BrandUniverseFile } from "../src/registry/build/types";
import {
  WAVE1_BRAND_CANDIDATES,
  importBrandCandidates,
} from "../src/registry/import/candidateImport";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UNIVERSE_FILE = join(ROOT, "data", "registry", "brand-universe.json");

const universe = JSON.parse(await readFile(UNIVERSE_FILE, "utf-8")) as BrandUniverseFile;
const result = importBrandCandidates(universe, WAVE1_BRAND_CANDIDATES);
await writeFile(UNIVERSE_FILE, JSON.stringify(result.universe, null, 2), "utf-8");

console.log(`Wave 1 already present: ${result.alreadyPresent.length}`);
for (const item of result.alreadyPresent) {
  console.log(`  - ${item.brand} (${item.reason})`);
}
console.log(`Wave 1 added: ${result.added.length}`);
for (const entry of result.added) {
  console.log(`  - ${entry.brand} [${entry.id}] ${entry.officialUrl}`);
}
console.log(`Total brands: ${result.universe.brands.length}`);
