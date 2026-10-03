import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { collectFarfetch, FARFETCH_ID } from "../src/collector/farfetch";
import { publishMarketplaceDelivery } from "../src/collector/marketplaceDelivery";
import { collect24S } from "../src/collector/twentyFourS";
import { FREE_PEOPLE_ID } from "../src/collector/freePeople";
import { collectFreePeopleWithBrowser } from "../src/collector/freePeopleBrowser";
import { collectLevelShoes, LEVEL_SHOES_ID } from "../src/collector/levelShoes";
import { collectTheWebster, THE_WEBSTER_ID } from "../src/collector/theWebster";
import type { PilotProduct } from "../src/collector/types";
import {
  AUTOMATED_MARKETPLACE_IDS,
  evaluateMarketplaceCandidate,
  replaceVerifiedMarketplaceCatalog,
  type AutomatedMarketplaceId,
  type MarketplaceGateReport,
  type MarketplaceRefreshCandidate,
} from "../src/marketplaces/automation";
import { isExcludedMarketplaceBrand } from "../src/marketplaces/marketplacePolicy";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_PATH = join(ROOT, "data", "multibrand", "products.json");
const ARTIFACT_DIR = join(ROOT, "data", "onboarding", "staging", "marketplace-refresh");
const REPORT_PATH = join(ARTIFACT_DIR, "report.json");

interface MarketplaceAutomationReport {
  schemaVersion: 1;
  startedAt: string;
  finishedAt: string;
  approvedSources: readonly AutomatedMarketplaceId[];
  discoveryEnabled: false;
  excludedMarketplaceIds: readonly ["amazon", "emag", "trendyol", "otto"];
  dataChanged: boolean;
  acceptedSources: string[];
  preservedSources: string[];
  gates: MarketplaceGateReport[];
}

async function atomicWrite(path: string, body: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, body, "utf8");
  await rename(temporary, path);
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`);
}

function excludedCount(products: readonly PilotProduct[]): number {
  return products.filter((product) => isExcludedMarketplaceBrand(product.brand)).length;
}

async function collectCandidate(sourceId: AutomatedMarketplaceId): Promise<MarketplaceRefreshCandidate> {
  if (sourceId === '24s') {
    const result = await collect24S();
    return {
      sourceId, products: result.products,
      coverageStatus: result.coverage.status as MarketplaceRefreshCandidate['coverageStatus'],
      sourceTotal: result.coverage.sourceReportedProductCount,
      rawCollected: result.coverage.rawProductCount,
      eligibleTotal: result.coverage.acceptedProductCount - excludedCount(result.products),
      paginationExhausted: result.coverage.pagesTraversed === result.coverage.expectedPages,
      errors: result.coverage.errors,
    };
  }
  if (sourceId === LEVEL_SHOES_ID) {
    const result = await collectLevelShoes({ maxPagesPerListing: 80, enrichDetails: false });
    const excluded = excludedCount(result.products);
    return {
      sourceId,
      products: result.products,
      coverageStatus: result.coverageStatus,
      sourceTotal: result.sourceReportedProductCount,
      rawCollected: result.uniqueSourceProducts,
      eligibleTotal: result.sourceReportedProductCount === null
        ? null
        : Math.max(0, result.sourceReportedProductCount - excluded),
      paginationExhausted: result.paginationExhausted,
      errors: result.errors,
    };
  }

  if (sourceId === FARFETCH_ID) {
    const result = await collectFarfetch({ maxPagesPerListing: 80 });
    return {
      sourceId,
      products: result.products,
      coverageStatus: result.coverageStatus,
      sourceTotal: null,
      rawCollected: result.products.length,
      eligibleTotal: null,
      paginationExhausted: result.paginationExhausted,
      errors: result.errors,
    };
  }

  if (sourceId === FREE_PEOPLE_ID) {
    const result = await collectFreePeopleWithBrowser({ headless: true, allowHeadedRetry: false });
    await writeJson(join(ARTIFACT_DIR, "free-people-collection-diagnostics.json"), {...result, products: undefined});
    const excluded = excludedCount(result.products);
    const full =
      result.status === "COLLECTED" &&
      result.paginationExhausted &&
      result.sourceReportedProductCount !== null &&
      result.products.length >= result.sourceReportedProductCount &&
      result.errors.length === 0;
    return {
      sourceId,
      products: result.products,
      coverageStatus: full ? "FULL" : result.products.length > 0 ? "PARTIAL" : "FAILED",
      sourceTotal: result.sourceReportedProductCount,
      rawCollected: result.products.length,
      eligibleTotal: result.sourceReportedProductCount === null
        ? null
        : Math.max(0, result.sourceReportedProductCount - excluded),
      paginationExhausted: result.paginationExhausted,
      errors: result.errors,
    };
  }

  const result = await collectTheWebster();
  return {
    sourceId: THE_WEBSTER_ID,
    products: result.products,
    coverageStatus: result.coverage.status,
    sourceTotal: result.coverage.sourceTotal,
    rawCollected: result.coverage.rawCollected,
    eligibleTotal: result.coverage.eligibleTotal,
    paginationExhausted: result.coverage.paginationExhausted,
    errors: result.coverage.errors,
    preExcludedByPolicy: result.coverage.excludedByPolicy,
  };
}

function failedCandidate(sourceId: AutomatedMarketplaceId, error: unknown): MarketplaceRefreshCandidate {
  return {
    sourceId,
    products: [],
    coverageStatus: "FAILED",
    sourceTotal: null,
    rawCollected: 0,
    eligibleTotal: null,
    paginationExhausted: false,
    errors: [error instanceof Error ? error.message : String(error)],
  };
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const originalBody = await readFile(PRODUCTS_PATH, "utf8");
  let catalog = JSON.parse(originalBody) as PilotProduct[];
  const gates: MarketplaceGateReport[] = [];
  let supplementalChanged = false;

  await mkdir(ARTIFACT_DIR, { recursive: true });
  console.log("=== CAPONE approved marketplace refresh ===");
  console.log(`Sources: ${AUTOMATED_MARKETPLACE_IDS.join(", ")}`);
  console.log("Automatic site discovery: disabled");

  for (const sourceId of AUTOMATED_MARKETPLACE_IDS) {
    console.log(`\nCollecting ${sourceId}...`);
    let candidate: MarketplaceRefreshCandidate;
    try {
      candidate = await collectCandidate(sourceId);
    } catch (error) {
      candidate = failedCandidate(sourceId, error);
    }
    if (sourceId === "24s") {
      let decision;
      try { decision = await publishMarketplaceDelivery(ROOT, candidate, "https://www.24s.com"); }
      catch (error) {
        decision = evaluateMarketplaceCandidate({ candidate: failedCandidate(sourceId, error), previousLastGood: [] });
      }
      gates.push(decision.report);
      await writeJson(join(ARTIFACT_DIR, `${sourceId}-gate.json`), decision.report);
      await writeJson(join(ARTIFACT_DIR, `${sourceId}-quarantine.json`), decision.quarantined);
      supplementalChanged ||= decision.report.accepted;
      continue;
    }
    // Intentionally use the current in-run catalog. A source accepted earlier
    // in this loop owns its URLs before the next source reaches the gate.
    const decision = evaluateMarketplaceCandidate({ candidate, previousLastGood: catalog });
    gates.push(decision.report);
    await writeJson(join(ARTIFACT_DIR, `${sourceId}-candidate.json`), candidate.products);
    await writeJson(join(ARTIFACT_DIR, `${sourceId}-gate.json`), decision.report);
    await writeJson(join(ARTIFACT_DIR, `${sourceId}-quarantine.json`), decision.quarantined);

    if (decision.report.accepted) {
      catalog = replaceVerifiedMarketplaceCatalog({
        existing: catalog,
        sourceId,
        verified: decision.eligibleProducts,
        preserveMissing: decision.report.publicationCoverage === "PARTIAL",
      });
      console.log(`${sourceId}: ${decision.report.publicationCoverage} delivery accepted; ${decision.quarantined.length} products quarantined.`);
    } else {
      console.log(`${sourceId}: last-good preserved (${decision.report.reasons.join("; ")}).`);
    }
  }

  const nextBody = JSON.stringify(catalog, null, 2);
  const coreChanged = nextBody !== originalBody.trimEnd();
  const dataChanged = coreChanged || supplementalChanged;
  if (coreChanged) await atomicWrite(PRODUCTS_PATH, nextBody);

  const report: MarketplaceAutomationReport = {
    schemaVersion: 1,
    startedAt,
    finishedAt: new Date().toISOString(),
    approvedSources: AUTOMATED_MARKETPLACE_IDS,
    discoveryEnabled: false,
    excludedMarketplaceIds: ["amazon", "emag", "trendyol", "otto"],
    dataChanged,
    acceptedSources: gates.filter((gate) => gate.accepted).map((gate) => gate.sourceId),
    preservedSources: gates.filter((gate) => !gate.accepted).map((gate) => gate.sourceId),
    gates,
  };
  await writeJson(REPORT_PATH, report);

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `data_changed=${String(dataChanged)}\n`, "utf8");
    await appendFile(process.env.GITHUB_OUTPUT, `accepted_sources=${report.acceptedSources.join(",")}\n`, "utf8");
    await appendFile(process.env.GITHUB_OUTPUT, `preserved_sources=${report.preservedSources.join(",")}\n`, "utf8");
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.acceptedSources.length) throw new Error("NO_UPDATE: every source preserved last-good; no marketplace refresh was accepted.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
