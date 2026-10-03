import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { convertUniverseToRegistryEntries } from "../registry/build/convertBrandUniverse";
import { buildCloudRefreshPlan, CLOUD_REFRESH_TRACKED_DATA_PATHS } from "./refreshPolicy";
import { buildBrandAutomationPlan } from "../brands/automation/plan";
import { loadAdapterFile } from "../onboarding/adapterStore";
import { loadQueueFile } from "../onboarding/queue";
import { OFFICIAL_SHOPIFY_BRAND_TARGETS, NEXT_OFFICIAL_SHOPIFY_BRAND_TARGETS } from "../brands/officialShopify/candidates";
import { EXPANSION_REFRESH_IDS } from "../onboarding/expansionRefresh";
import { AUTOMATED_MARKETPLACE_IDS } from "../marketplaces/automation";
import type { BrandUniverseFile } from "../registry/build/types";

export interface RefreshLane {
  id: string;
  brands: string[];
  marketplaces: string[];
  scripts: string[][];
  reports: string[];
}

// One checkout, source-isolated collection, one final validation/publication gate.
export const CYCLE_DELIVERY_PATHS = [
  ...CLOUD_REFRESH_TRACKED_DATA_PATHS,
  "data/multibrand/model-families",
  "data/multibrand/taxonomy-qa-report.json",
  "data/brands/wave50/last-good",
  "data/onboarding/validated",
  "data/registry/brand-universe.json",
  "data/registry/brand-universe-report.json",
  "data/registry/priority-brand-coverage.json",
  "data/registry/marketplace-pilot.json",
  "src/registry/data/brands.ts",
] as const;

export function assertRefreshCoverage(brands: string[], marketplaces: string[], lanes: RefreshLane[]): void {
  const coveredBrands = new Set(lanes.flatMap((lane) => lane.brands));
  const coveredMarketplaces = new Set(lanes.flatMap((lane) => lane.marketplaces));
  const missing = [
    ...brands.filter((id) => !coveredBrands.has(id)).map((id) => `brand:${id}`),
    ...marketplaces.filter((id) => !coveredMarketplaces.has(id)).map((id) => `marketplace:${id}`),
  ];
  if (missing.length) throw new Error(`Active sources missing from refresh cycle: ${missing.join(", ")}`);
}

export async function buildRefreshCyclePlan(root: string) {
  const universe = JSON.parse(await readFile(join(root, "data/registry/brand-universe.json"), "utf8")) as BrandUniverseFile;
  // Read the current activation state, including newly onboarded sources.
  const { entries: brandEntries } = convertUniverseToRegistryEntries({ universe: universe.brands });
  const activeBrands = universe.brands.filter((brand) => brand.isActive).map((brand) => brand.id);
  const pilot = JSON.parse(await readFile(join(root, "data/registry/marketplace-pilot.json"), "utf8")) as { activeMarketplaceIds: string[] };
  const activeMarketplaces = pilot.activeMarketplaceIds;
  const automation = buildBrandAutomationPlan({
    universe,
    adapters: await loadAdapterFile(root),
    queue: await loadQueueFile(root),
    lastGoodSlugs: new Set((await readdir(join(root, "data/brands/wave50/last-good"))).filter((file) => file.endsWith(".json")).map((file) => file.slice(0, -5))),
    refreshOnly: true,
  });
  const active = (ids: readonly string[]) => ids.filter((id) => activeBrands.includes(id));
  const cloudBrands = buildCloudRefreshPlan({ brands: brandEntries, includeMarketplaces: false }).brands.map((brand) => brand.id);
  const automaticBrands = automation.candidates.map((brand) => brand.slug).filter((id) => !cloudBrands.includes(id));
  const lanes: RefreshLane[] = [
    { id: "official-brands", brands: automaticBrands, marketplaces: [], scripts: [["run-brand-automation.ts", "--refresh-only", "--only", automaticBrands.join(",")]], reports: ["data/registry/brand-automation-report.json"] },
    { id: "cloud-brands", brands: cloudBrands, marketplaces: [], scripts: [["refresh-cloud.ts"]], reports: ["logs/cloud-refresh-report.json", "data/multibrand/collection-report.json"] },
    { id: "official-shopify", brands: active(OFFICIAL_SHOPIFY_BRAND_TARGETS.map((brand) => brand.slug)).filter((id) => !["sergio-rossi", "margaux"].includes(id)), marketplaces: [], scripts: [["collect-official-shopify.ts", "--refresh-only", "--exclude", "sergio-rossi,margaux"]], reports: ["data/registry/issue-91-brand-connections.json"] },
    { id: "official-shopify-next", brands: active(NEXT_OFFICIAL_SHOPIFY_BRAND_TARGETS.map((brand) => brand.slug)).filter((id) => !["sergio-rossi", "margaux"].includes(id)), marketplaces: [], scripts: [["collect-official-shopify-next.ts", "--refresh-only", "--exclude", "sergio-rossi,margaux"]], reports: ["data/registry/issue-91-next-brands.json"] },
    { id: "browns", brands: [], marketplaces: ["browns"], scripts: [["collect-browns.ts"], ["verify-issue-91-refresh.ts"]], reports: ["data/registry/issue-91-browns-marketplace.json"] },
    { id: "expansion", brands: active(EXPANSION_REFRESH_IDS), marketplaces: [], scripts: [["refresh-expansion-brands.ts"]], reports: ["data/onboarding/staging/expansion-refresh/report.json"] },
    { id: "priority", brands: active(["massimo-dutti", "ala-a", "maison-margiela"]), marketplaces: [], scripts: [["refresh-priority-sources.ts"]], reports: ["data/onboarding/staging/priority-refresh/report.json"] },
    { id: "marketplaces", brands: [], marketplaces: [...AUTOMATED_MARKETPLACE_IDS], scripts: [["refresh-marketplaces-automated.ts"]], reports: ["data/onboarding/staging/marketplace-refresh/report.json"] },
  ];
  assertRefreshCoverage(activeBrands, activeMarketplaces, lanes);
  return { schemaVersion: 1, startedAt: new Date().toISOString(), activeBrands, activeMarketplaces, lanes };
}
