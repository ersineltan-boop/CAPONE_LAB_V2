import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { brandEntries } from "../src/registry/data/brands";
import { registryEntryToUniverseEntry } from "../src/registry/build/convertBrandUniverse";
import type { BrandUniverseFile } from "../src/registry/build/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_PATH = join(ROOT, "data", "registry", "brand-universe.json");

const universe: BrandUniverseFile = {
  version: 1,
  generatedAt: new Date().toISOString(),
  brands: brandEntries.map(registryEntryToUniverseEntry),
};

await mkdir(dirname(OUT_PATH), { recursive: true });
await writeFile(OUT_PATH, JSON.stringify(universe, null, 2), "utf-8");

console.log(`Migrated ${universe.brands.length} brands → data/registry/brand-universe.json`);
