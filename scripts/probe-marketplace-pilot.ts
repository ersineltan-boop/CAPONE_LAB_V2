import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MARKETPLACE_PROBE_CANDIDATES,
  probeMarketplaceCandidates,
  selectSuccessfulPilot,
} from "../src/registry/marketplaceProbe";
import { collectMarketplaceListing } from "../src/collector/marketplaceHtml";
import { mergeProductCatalog } from "../src/collector/mergeProducts";
import type { PilotProduct } from "../src/collector/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_FILE = join(ROOT, "data", "registry", "marketplace-probe-report.json");
const PILOT_STATE_FILE = join(ROOT, "data", "registry", "marketplace-pilot.json");
const PRODUCTS_FILE = join(ROOT, "data", "multibrand", "products.json");

async function loadExisting(): Promise<PilotProduct[]> {
  try {
    return JSON.parse(await readFile(PRODUCTS_FILE, "utf-8")) as PilotProduct[];
  } catch {
    return [];
  }
}

async function main() {
  console.log("\n=== CAPONE Marketplace Pilot Probe ===");
  const results = await probeMarketplaceCandidates();
  const selected = selectSuccessfulPilot(results);
  console.log("Probe results:");
  for (const result of results) {
    console.log(
      `- ${result.name}: ${result.ok ? "OK" : "FAIL"} · links=${result.productLinkCount} · blocked=${result.blocked}`,
    );
  }

  let collected = 0;
  let collectErrors: string[] = [];
  if (selected) {
    const candidate = MARKETPLACE_PROBE_CANDIDATES.find((item) => item.id === selected.id)!;
    const listing = await collectMarketplaceListing(candidate, { maxPages: 8 });
    collected = listing.products.length;
    collectErrors = listing.errors;
    if (listing.products.length > 0) {
      const existing = await loadExisting();
      const marketplaceIds = new Set(MARKETPLACE_PROBE_CANDIDATES.map((item) => item.id));
      const withoutPilots = existing.filter(
        (product) => product.source !== selected.id && !marketplaceIds.has(product.source),
      );
      const merged = mergeProductCatalog(withoutPilots, listing.products);
      await mkdir(dirname(PRODUCTS_FILE), { recursive: true });
      await writeFile(PRODUCTS_FILE, JSON.stringify(merged, null, 2), "utf-8");
    }
  }

  await mkdir(dirname(REPORT_FILE), { recursive: true });
  await writeFile(
    REPORT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        results,
        selectedPilotId: selected?.id ?? null,
        collectedProducts: collected,
        collectErrors,
      },
      null,
      2,
    ),
    "utf-8",
  );

  let existingState: { mytheresaStatus?: string } = {};
  try {
    existingState = JSON.parse(await readFile(PILOT_STATE_FILE, "utf-8"));
  } catch {
    existingState = {};
  }

  await writeFile(
    PILOT_STATE_FILE,
    JSON.stringify(
      {
        activePilotId: selected && collected > 0 ? selected.id : existingState.mytheresaStatus === "ACTIVE" ? "mytheresa" : selected?.id ?? null,
        mytheresaStatus: existingState.mytheresaStatus ?? "NEEDS_BROWSER_OR_ADAPTER",
        notes: selected
          ? `Fallback pilot: ${selected.name}`
          : "No collectable luxury marketplace found",
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log(`Selected: ${selected?.name ?? "none"}`);
  console.log(`Collected products: ${collected}`);
}

main();
