import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { NEXT_OFFICIAL_SHOPIFY_BRAND_TARGETS, NEXT_OFFICIAL_SHOPIFY_REFRESH_COMMAND } from "../src/brands/officialShopify/candidates";
import { collectOfficialShopifyBrand, type OfficialBrandEvidence, type OfficialHttp } from "../src/brands/officialShopify/collect";
import { publishOfficialBrandCatalog } from "../src/brands/officialShopify/publish";
import { defaultOnboardingHttp } from "../src/onboarding/http";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const http: OfficialHttp = {
  fetchText: (url) => defaultOnboardingHttp.fetchText(url, { timeoutMs: 30000 }),
};

const now = new Date().toISOString();
const evidence: OfficialBrandEvidence[] = [];
const published: string[] = [];

const refreshOnly = process.argv.includes("--refresh-only");
const excludeIndex = process.argv.indexOf("--exclude");
const excluded = new Set(excludeIndex >= 0 ? (process.argv[excludeIndex + 1] ?? "").split(",") : []);
const universe = JSON.parse(await readFile(join(root, "data/registry/brand-universe.json"), "utf8")) as { brands: Array<{ id: string; isActive: boolean }> };
const active = new Set(universe.brands.filter((brand) => brand.isActive).map((brand) => brand.id));
for (const target of NEXT_OFFICIAL_SHOPIFY_BRAND_TARGETS.filter((item) => !excluded.has(item.slug) && (!refreshOnly || active.has(item.slug)))) {
  process.stdout.write(`collect ${target.slug}\n`);
  try {
    const result = await collectOfficialShopifyBrand(target, http, now, { refresh: active.has(target.slug) });
    let publishBlocker: string | null = result.evidence.blocker;
    if (result.evidence.status === "FULL") {
      const delivery = await publishOfficialBrandCatalog({
        root,
        catalog: result.catalog,
        evidence: result.evidence,
        http,
      });
      publishBlocker = delivery.blocker;
      if (delivery.published) published.push(`${target.slug}:${delivery.families}`);
    }
    const lastGoodPath = join(root, "data/brands/wave50/last-good", `${target.slug}.json`);
    const lastGoodRetained = result.evidence.status !== "FULL" || publishBlocker != null
      ? await access(lastGoodPath).then(() => true, () => false)
      : false;
    evidence.push({
      ...result.evidence,
      blocker: result.evidence.status === "FULL" ? publishBlocker : result.evidence.blocker,
      lastGoodRetained,
    });
    process.stdout.write(
      `${target.slug} ${result.evidence.status} fetched=${result.evidence.fetchedProducts} storefront=${result.evidence.storefrontProductCount} families=${result.evidence.modelFamilies} publish=${publishBlocker ?? "published"}\n`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    evidence.push({
      slug: target.slug,
      brand: target.brand,
      sourceUrls: target.collections.map((collection) => `${target.origin}${target.localePath}/collections/${collection.handle}`),
      collectedAt: now,
      pagesVisited: 0,
      storefrontProductCount: null,
      collectionResourceCount: null,
      fetchedProducts: 0,
      acceptedFootwear: 0,
      quarantined: 0,
      quarantineReasons: {},
      modelFamilies: 0,
      status: "FAILED",
      paginationExhausted: false,
      baselineNewArrivals: 0,
      blocker: message,
      refreshCommand: NEXT_OFFICIAL_SHOPIFY_REFRESH_COMMAND,
      periodicRefresh: true,
      note: "Collector failed before a catalog was written. Existing catalog data was not replaced.",
    });
    process.stdout.write(`${target.slug} FAILED ${error instanceof Error ? error.stack ?? message : message}\n`);
  }
}

const report = {
  issue: 91,
  generatedAt: now,
  periodicRefresh: true,
  refreshCommand: NEXT_OFFICIAL_SHOPIFY_REFRESH_COMMAND,
  dependsOn: "cursor/issue-91-official-brands-0302",
  notCollected: [
    "Nodaleto is owned by the Codex catalog and is not collected again.",
    "Pedro Miralles products.json is public, but the calzado page has no single storefront total, so it was not activated.",
  ],
  published,
  brands: evidence,
};
await writeFile(join(root, "data/registry/issue-91-next-brands.json"), JSON.stringify(report, null, 2));
process.stdout.write(`published ${published.join(", ") || "none"}\n`);
