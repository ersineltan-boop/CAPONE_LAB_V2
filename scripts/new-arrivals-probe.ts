import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadBrandRegistry } from "../src/registry/data/index";
import { loadMarketplaceRegistry } from "../src/registry/data/marketplaces";
import { isNewArrivalsCollectionPath } from "../src/newArrivals/detectNewness";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = join(ROOT, "data", "registry", "new-arrivals-probe-report.json");

interface ProbeEntry {
  sourceId: string;
  sourceLabel: string;
  sourceType: "BRAND" | "MARKETPLACE";
  discoveryStatus: string;
  newArrivalDiscoveryStatus: string;
  candidateUrls: string[];
  candidateHandles: string[];
  verified: boolean;
  evidenceStrategy: string | null;
}

function probeBrandNewArrivalPaths(entry: {
  id: string;
  brand: string;
  collectionPaths: readonly string[];
  footwearCollectionHandles?: readonly string[];
  footwearCollectionUrls?: readonly string[];
  newArrivalUrls?: readonly string[];
  newArrivalCollectionHandles?: readonly string[];
  newArrivalDiscoveryStatus?: string;
  collectionDiscoveryStatus?: string;
}): ProbeEntry {
  const candidateHandles = [
    ...(entry.newArrivalCollectionHandles ?? []),
    ...(entry.footwearCollectionHandles ?? []).filter(isNewArrivalsCollectionPath),
    ...(entry.collectionPaths ?? []).filter(isNewArrivalsCollectionPath),
  ];
  const candidateUrls = [
    ...(entry.newArrivalUrls ?? []),
    ...(entry.footwearCollectionUrls ?? []).filter((url) =>
      isNewArrivalsCollectionPath(url),
    ),
  ];

  const verified =
    entry.newArrivalDiscoveryStatus === "VERIFIED" ||
    candidateHandles.length > 0 ||
    candidateUrls.length > 0;

  return {
    sourceId: entry.id,
    sourceLabel: entry.brand,
    sourceType: "BRAND",
    discoveryStatus: entry.collectionDiscoveryStatus ?? "UNKNOWN",
    newArrivalDiscoveryStatus: entry.newArrivalDiscoveryStatus ?? "NEEDS_PROBE",
    candidateUrls: [...new Set(candidateUrls)],
    candidateHandles: [...new Set(candidateHandles)],
    verified,
    evidenceStrategy: verified ? "NEW_ARRIVALS_COLLECTION" : null,
  };
}

async function main() {
  const brands = loadBrandRegistry().all();
  const marketplaces = loadMarketplaceRegistry();

  const brandProbes = brands.map((entry) => probeBrandNewArrivalPaths(entry));
  const marketplaceProbes: ProbeEntry[] = marketplaces.map((entry) => ({
    sourceId: entry.id,
    sourceLabel: entry.name,
    sourceType: "MARKETPLACE",
    discoveryStatus: entry.discoveryStatus,
    newArrivalDiscoveryStatus: entry.newArrivalDiscoveryStatus,
    candidateUrls: [...(entry.newArrivalUrls ?? [])],
    candidateHandles: [...(entry.newArrivalCollectionHandles ?? [])],
    verified: entry.newArrivalDiscoveryStatus === "VERIFIED",
    evidenceStrategy: entry.newArrivalDiscoveryStatus === "VERIFIED" ? "NEW_ARRIVALS_COLLECTION" : null,
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    brandCount: brandProbes.length,
    marketplaceCount: marketplaceProbes.length,
    verifiedBrandSources: brandProbes.filter((entry) => entry.verified).length,
    verifiedMarketplaceSources: marketplaceProbes.filter((entry) => entry.verified).length,
    brands: brandProbes,
    marketplaces: marketplaceProbes,
  };

  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");

  console.log("\n=== CAPONE New Arrivals Probe ===");
  console.log(`Brands probed: ${brandProbes.length}`);
  console.log(`Verified brand new-arrival configs: ${report.verifiedBrandSources}`);
  console.log(`Marketplaces: ${marketplaceProbes.length}`);
  console.log(`Verified marketplace configs: ${report.verifiedMarketplaceSources}`);
  console.log(`Report: ${REPORT_PATH}`);
}

main();
