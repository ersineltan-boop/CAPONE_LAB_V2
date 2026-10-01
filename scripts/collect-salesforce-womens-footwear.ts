import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { fetchText } from "../src/collector/http";
import { decideSalesforcePublish } from "../src/collector/salesforceCommerce/coverage";
import { collectVerifiedSalesforceCatalog } from "../src/collector/salesforceCommerce/integration";
import { collectJacquemusWomensShoes } from "../src/collector/salesforceCommerce/jacquemus";

import { SALESFORCE_INTEGRATION_PATCH } from "../src/collector/salesforceCommerce/index";
import type { SalesforceCatalog, SalesforceHttp } from "../src/collector/salesforceCommerce/types";

const http: SalesforceHttp = {
  async fetchText(url) {
    const response = await fetchText(url, { delayMs: 150 });
    return response;
  },
};

const root = process.cwd();
const reportPath = join(root, "data/registry/salesforce-commerce-womens-footwear-report.json");
const lastGoodDir = join(root, "data/brands/salesforce-commerce/last-good");

async function previousAccepted(slug: string): Promise<number | null> {
  try {
    const previous = JSON.parse(await readFile(join(lastGoodDir, `${slug}.json`), "utf8")) as {
      accepted?: unknown[];
    };
    return Array.isArray(previous.accepted) ? previous.accepted.length : null;
  } catch {
    return null;
  }
}

function summarize(catalog: SalesforceCatalog, publish: { publish: boolean; retainPrevious: boolean; blocker: string | null }) {
  return {
    brand: catalog.scope.brand,
    slug: catalog.scope.slug,
    status: catalog.status,
    blocker: catalog.blocker,
    collectedAt: catalog.collectedAt,
    scope: catalog.scope,
    sourceReportedTotal: catalog.sourceReportedTotal,
    scopeProductUrls: catalog.scopeProductUrls.length,
    acceptedFootwear: catalog.accepted.length,
    quarantined: catalog.quarantined.length,
    quarantineReasons: catalog.quarantined.reduce<Record<string, number>>((counts, item) => {
      counts[item.reason] = (counts[item.reason] ?? 0) + 1;
      return counts;
    }, {}),
    modelCards: catalog.families.length,
    multiColorCards: catalog.families.filter((family) => family.colorways.length > 1).length,
    pagesVisited: catalog.pagesVisited.length,
    pageUrls: catalog.pagesVisited,
    paginationExhausted: catalog.paginationExhausted,
    galleryColorways: catalog.accepted.filter((product) => product.images.length > 0).length,
    sizeRecords: catalog.accepted.reduce((sum, product) => sum + product.sizes.length, 0),
    sizeRecordsWithSku: catalog.accepted.reduce(
      (sum, product) => sum + product.sizes.filter((size) => size.sku).length,
      0,
    ),
    newProducts: catalog.newProducts,
    sampleProductUrls: catalog.scopeProductUrls.slice(0, 8),
    quarantinedProducts: catalog.quarantined.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      reason: item.reason,
      productUrl: item.productUrl,
    })),
    errors: catalog.errors,
    attempts: catalog.attempts ?? [],
    publish,
    refreshCommand: catalog.status === "BLOCKED" ? null : "npm run collect:salesforce-womens-footwear",
    periodicSchedule: "Existing daily official-source refresh after activation",
  };
}

async function main(): Promise<void> {
  const collect = (id: string, baseUrl: string) => collectVerifiedSalesforceCatalog({id, brand: id, baseUrl, collectionPaths: [], maxProducts: 200}, http);
  const casadei = await collect("casadei", "https://www.casadei.com");
  const jilSander = await collect("jil-sander", "https://www.jilsander.com");
  const jacquemus = await collectJacquemusWomensShoes(http);

  const catalogs = [casadei, jilSander, jacquemus];
  const publications = [];
  for (const catalog of catalogs) {
    const decision = decideSalesforcePublish({
      previousAccepted: await previousAccepted(catalog.scope.slug),
      status: catalog.status,
      acceptedFootwear: catalog.accepted.length,
    });
    publications.push(decision);
    if (!decision.publish) continue;
    const target = join(lastGoodDir, `${catalog.scope.slug}.json`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify({
      ...catalog,
      baseline: true,
      priceIncluded: false,
    }, null, 2));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    issue: "Salesforce Commerce CUSTOM_ADAPTER_REQUIRED for CASADEI, JACQUEMUS, and JIL SANDER",
    before: {
      casadei: "CUSTOM_ADAPTER_REQUIRED productsFound=0",
      jacquemus: "CUSTOM_ADAPTER_REQUIRED productsFound=0",
      jilSander: "CUSTOM_ADAPTER_REQUIRED productsFound=0",
    },
    brands: catalogs.map((catalog, index) => summarize(catalog, publications[index]!)),
    integrationPatch: SALESFORCE_INTEGRATION_PATCH,
    notes: [
      "JW Anderson and Margaux were not collected.",
      "Shared onboarding and regular registry refresh use the verified Salesforce integration.",
      "Blocked or partial sources do not replace last-good and are not marked FULL.",
    ],
  };
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.brands.map((brand) => ({
    brand: brand.brand,
    status: brand.status,
    blocker: brand.blocker,
    sourceReportedTotal: brand.sourceReportedTotal,
    scopeProductUrls: brand.scopeProductUrls,
    acceptedFootwear: brand.acceptedFootwear,
    quarantined: brand.quarantined,
    modelCards: brand.modelCards,
    pagesVisited: brand.pagesVisited,
  })), null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
