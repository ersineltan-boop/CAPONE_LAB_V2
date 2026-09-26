import { WAVE_ACCESSIBLE_COLLECT_LIMIT, WAVE_COLLECTOR_CONCURRENCY } from "./types";
import type { WaveBrandOutcome, WaveBrandSeed, WaveHttp, WaveRunReport } from "./types";
import { mapPool } from "./pool";
import { classifyStorefrontResponse, collectShopifyWomensCatalog } from "./shopifyAdapter";
import { publishLastGoodCatalog, stageCatalog } from "./publish";

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url.replace(/\/$/, "");
  }
}

async function probeSeed(
  seed: WaveBrandSeed,
  http: WaveHttp,
  now: string,
): Promise<WaveBrandOutcome> {
  const base = originOf(seed.officialUrl);
  const [homepage, products, collections] = await Promise.all([
    http.fetch(base),
    http.fetch(`${base}/products.json?limit=1`),
    http.fetch(`${base}/collections.json?limit=1`),
  ]);
  const disposition = classifyStorefrontResponse({ homepage, products, collections });
  return {
    slug: seed.slug,
    brand: seed.brand,
    officialUrl: seed.officialUrl,
    disposition,
    platform: disposition === "ACCESSIBLE" ? "SHOPIFY" : "UNKNOWN",
    attemptedAt: now,
    fullCatalogPassed: false,
    published: false,
    lastGoodRetained: false,
    blocker: disposition === "ACCESSIBLE" ? null : disposition,
    coverage: null,
    newArrivalsFootwear: null,
    families: null,
    referenceFootwearMatch: null,
    referenceNewArrivalsMatch: null,
  };
}

export async function runBrandsWave(input: {
  root: string;
  seeds: readonly WaveBrandSeed[];
  http: WaveHttp;
  now?: string;
  concurrency?: number;
  accessibleLimit?: number;
  previousUrlsBySlug?: ReadonlyMap<string, ReadonlySet<string>>;
  universeBrandsBefore?: number;
  universeBrandsAfter?: number;
  activeBrandsBefore?: number;
  activeBrandsAfter?: number;
  netNewUniverseBrands?: number;
  netNewActiveBrands?: number;
  newActivations?: Array<{ slug: string; brand: string }>;
  initialSiteDeliveryFamilies?: number;
  siteDeliveryFamilies?: number;
  siteDeliveryProducts?: number;
}): Promise<WaveRunReport> {
  const now = input.now ?? new Date().toISOString();
  const concurrency = input.concurrency ?? WAVE_COLLECTOR_CONCURRENCY;
  const accessibleLimit = input.accessibleLimit ?? WAVE_ACCESSIBLE_COLLECT_LIMIT;

  const probed = await mapPool(input.seeds, concurrency, async (seed, index) => {
    try {
      const outcome = await probeSeed(seed, input.http, now);
      console.log(`[probe ${index + 1}/${input.seeds.length}] ${seed.slug} ${outcome.disposition}`);
      return outcome;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        slug: seed.slug,
        brand: seed.brand,
        officialUrl: seed.officialUrl,
        disposition: "SOURCE_UNAVAILABLE" as const,
        platform: "UNKNOWN" as const,
        attemptedAt: now,
        fullCatalogPassed: false,
        published: false,
        lastGoodRetained: false,
        blocker: message,
        coverage: null,
        newArrivalsFootwear: null,
        families: null,
        referenceFootwearMatch: null,
        referenceNewArrivalsMatch: null,
      };
    }
  });

  const accessible = input.seeds.filter((_, index) => probed[index]?.disposition === "ACCESSIBLE");
  const collectTargets = accessible.slice(0, accessibleLimit);
  const outcomes = new Map(probed.map((outcome) => [outcome.slug, outcome]));

  await mapPool(collectTargets, concurrency, async (seed) => {
    const outcome = outcomes.get(seed.slug);
    if (!outcome) return;
    try {
      const collected = await collectShopifyWomensCatalog({
        seed,
        http: input.http,
        now,
        previousUrls: input.previousUrlsBySlug?.get(seed.slug) ?? null,
        baseUrl: originOf(seed.officialUrl),
      });
      if (collected.catalog) await stageCatalog(input.root, collected.catalog);
      const published = await publishLastGoodCatalog(input.root, collected.catalog);
      outcome.coverage = collected.coverage;
      outcome.newArrivalsFootwear = collected.catalog?.newArrivalsFootwear ?? null;
      outcome.families = collected.catalog?.families.length ?? null;
      outcome.referenceFootwearMatch = collected.catalog?.referenceFootwearMatch ?? null;
      outcome.referenceNewArrivalsMatch = collected.catalog?.referenceNewArrivalsMatch ?? null;
      outcome.fullCatalogPassed = published.published;
      outcome.published = published.published;
      outcome.lastGoodRetained = published.retained;
      outcome.blocker = published.blocker;
      console.log(
        `[collect] ${seed.slug} ${published.published ? "FULL" : published.blocker ?? "FAILED"} collected=${collected.coverage?.collected ?? 0}`,
      );
    } catch (error) {
      outcome.blocker = error instanceof Error ? error.message : String(error);
      outcome.fullCatalogPassed = false;
      outcome.published = false;
      outcome.lastGoodRetained = true;
    }
  });

  const ordered = input.seeds.map((seed) => outcomes.get(seed.slug)!);
  const passed = ordered.filter((outcome) => outcome.fullCatalogPassed);
  return {
    version: 1,
    generatedAt: now,
    concurrency,
    attempted: ordered.length,
    accessible: ordered.filter((outcome) => outcome.disposition === "ACCESSIBLE").length,
    fullCatalogPassed: passed.length,
    publishedCatalogs: passed.length,
    customAdapter: ordered.filter((outcome) => outcome.disposition === "CUSTOM_ADAPTER_REQUIRED").length,
    sourceUnavailable: ordered.filter((outcome) => outcome.disposition === "SOURCE_UNAVAILABLE").length,
    stagingProducts: passed.reduce((sum, outcome) => sum + (outcome.coverage?.collected ?? 0), 0),
    universeBrandsBefore: input.universeBrandsBefore ?? 0,
    universeBrandsAfter: input.universeBrandsAfter ?? 0,
    activeBrandsBefore: input.activeBrandsBefore ?? 0,
    activeBrandsAfter: input.activeBrandsAfter ?? 0,
    netNewUniverseBrands: input.netNewUniverseBrands ?? 0,
    netNewActiveBrands: input.netNewActiveBrands ?? 0,
    newActivations: input.newActivations ?? [],
    initialSiteDeliveryFamilies: input.initialSiteDeliveryFamilies ?? 0,
    siteDeliveryFamilies: input.siteDeliveryFamilies ?? 0,
    siteDeliveryProducts: input.siteDeliveryProducts ?? 0,
    collectTargets: collectTargets.length,
    outcomes: ordered,
  };
}
