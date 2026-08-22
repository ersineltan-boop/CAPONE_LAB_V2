import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeBrandId } from "../src/registry/build/normalize";
import type { BrandUniverseFile } from "../src/registry/build/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const UNIVERSE_FILE = join(ROOT, "data", "registry", "brand-universe.json");

const READY_BRANDS = [
  "THE ROW",
  "KHAITE",
  "TOTEME",
  "LEMAIRE",
  "DRIES VAN NOTEN",
  "PROENZA SCHOULER",
];

const readyIds = new Set(READY_BRANDS.map((brand) => normalizeBrandId(brand)));

const universe = JSON.parse(await readFile(UNIVERSE_FILE, "utf-8")) as BrandUniverseFile;

let activated = 0;
for (const entry of universe.brands) {
  if (!readyIds.has(entry.id)) continue;

  entry.isActive = true;
  entry.collectorType = "SHOPIFY_PUBLIC";
  entry.collectionStatus = "READY_AUTOMATIC";
  entry.productLimit = 30;
  entry.supportsMultipleImages = true;
  entry.classificationStatus = "UNREVIEWED";
  entry.radarEligible = false;
  entry.notes = "Wave 2 — activated after READY_AUTOMATIC probe (classification pending)";
  activated += 1;
}

await writeFile(UNIVERSE_FILE, JSON.stringify(universe, null, 2), "utf-8");

console.log(`Activated ${activated}/${READY_BRANDS.length} Wave 2 READY brands`);
