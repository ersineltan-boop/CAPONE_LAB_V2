import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getRomaniaCatalog } from "../src/marketResearch/romania/catalog";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function writeCatalog(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const catalog = getRomaniaCatalog();
  await writeFile(join(dir, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf-8");
}

export async function buildMarketResearchFrontend(): Promise<void> {
  await writeCatalog(join(ROOT, "data", "market-research", "romania"));
  await writeCatalog(join(ROOT, "public", "data", "market-research", "romania"));
  console.log("Published Romania market-research snapshot.");
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirect) {
  await buildMarketResearchFrontend();
}
