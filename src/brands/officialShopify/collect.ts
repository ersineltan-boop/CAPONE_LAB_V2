import { normalizeProductImageUrls } from "../../images/resolveImageQuality";
import type { FootwearCategory } from "../../collector/types";
import { classifyWomensFootwear } from "../wave50/footwearScope";
import { groupColorwaysIntoFamilies, type FamilyProduct } from "../wave50/families";
import { buildWaveCoverage } from "../wave50/coverage";
import {
  classifyOfficialFootwear,
  isNonFootwearCatalogItem,
  legacyCategoryForPrimary,
} from "../wave50/primaryCategory";
import type { WaveCatalog, WaveModelFamily } from "../wave50/types";
import { isColorSwatchImage, parseStorefrontProductCount } from "./storefrontCount";
import type { OfficialBrandTarget } from "./candidates";
import { OFFICIAL_SHOPIFY_REFRESH_COMMAND } from "./candidates";

export const OFFICIAL_PAGE_SIZE = 50;
export const OFFICIAL_PAGE_CAP = 80;

export interface OfficialHttpResponse {
  ok: boolean;
  status: number;
  url: string;
  text: string;
  error?: string;
}

export interface OfficialHttp {
  fetchText(url: string): Promise<OfficialHttpResponse>;
}

interface ShopifyImage {
  src?: string;
}

interface ShopifyVariant {
  title?: string;
  sku?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  featured_image?: { src?: string } | null;
}

interface ShopifyOption {
  name?: string;
}

interface ShopifyProduct {
  id?: number;
  title?: string;
  handle?: string;
  product_type?: string;
  tags?: string[] | string;
  images?: ShopifyImage[];
  variants?: ShopifyVariant[];
  options?: ShopifyOption[];
}

export interface OfficialBrandEvidence {
  slug: string;
  brand: string;
  sourceUrls: string[];
  collectedAt: string;
  pagesVisited: number;
  storefrontProductCount: number | null;
  collectionResourceCount: number | null;
  fetchedProducts: number;
  acceptedFootwear: number;
  quarantined: number;
  quarantineReasons: Record<string, number>;
  modelFamilies: number;
  status: "FULL" | "PARTIAL" | "FAILED";
  paginationExhausted: boolean;
  baselineNewArrivals: 0;
  blocker: string | null;
  refreshCommand: string;
  periodicRefresh: false;
  lastGoodRetained?: boolean;
  note: string;
}

export interface OfficialCollectResult {
  evidence: OfficialBrandEvidence;
  catalog: WaveCatalog | null;
}

function collectionUrl(target: OfficialBrandTarget, handle: string): string {
  return `${target.origin}${target.localePath}/collections/${handle}`;
}

function asTags(value: string[] | string | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value)
    ? value.map((tag) => tag.trim()).filter(Boolean)
    : value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function colorFromOptions(product: ShopifyProduct): string | null {
  const options = product.options ?? [];
  const colorIndex = options.findIndex((option) =>
    /color|colour|coloris|couleur|colore|색상/i.test(option.name ?? ""),
  );
  if (colorIndex < 0) return null;
  const values = new Set<string>();
  for (const variant of product.variants ?? []) {
    const value = colorIndex === 0 ? variant.option1 : colorIndex === 1 ? variant.option2 : variant.option3;
    if (value?.trim() && !/^default(\s+title)?$/i.test(value.trim())) values.add(value.trim());
  }
  return values.size === 1 ? [...values][0] ?? null : null;
}

function productImages(product: ShopifyProduct): string[] {
  return normalizeProductImageUrls([
    ...(product.images ?? []).map((image) => image.src),
    ...(product.variants ?? []).map((variant) => variant.featured_image?.src),
  ]).filter((url) => !isColorSwatchImage(url));
}

function bump(reasons: Record<string, number>, reason: string): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

function categoryFromLabel(value: string): FootwearCategory | null {
  const text = value.toLowerCase();
  if (/sandale|sandalia|sandal|tong|tropez|alpargata/.test(text)) return "SANDAL";
  if (/bot[ií]n/.test(text)) return "ANKLE_BOOT";
  if (/bottine|ankle boot|boot/.test(text)) return /ankle/.test(text) ? "ANKLE_BOOT" : "BOOT";
  if (/sneaker|basket|trainer|velcro|deportivo/.test(text)) return "SNEAKER";
  if (/sling/.test(text)) return "SLINGBACK";
  if (/pump|escarpin|sal[oó]n|talon|\bheels?\b|tac[oó]n/.test(text)) return "PUMP";
  if (/ballerin|bailarina|ballet|\bflats?\b/.test(text)) return "BALLERINA";
  if (/loafer|mocassin|mocas[ií]n|slip-?on|lace-?up|buckle|closed shoes?|elasticated|acordonad|derbi/.test(text)) return "LOAFER";
  if (/ankle strap|merceditas|salom[eé]/.test(text)) return "MARY_JANE";
  if (/mule|destalon/.test(text)) return "MULE";
  if (/wedge|compens/.test(text)) return "WEDGE";
  return null;
}

function footwearCategory(input: {
  title: string;
  productType: string;
  tags: string[];
  handle: string;
  collectionHandle: string;
}): { category: FootwearCategory } | { reason: string } {
  if (isNonFootwearCatalogItem({ title: input.title })) return { reason: "non-footwear-title" };
  const scope = classifyWomensFootwear({
    title: input.title,
    productType: input.productType,
    tags: input.tags,
    handle: input.handle,
    fromVerifiedFootwearCollection: true,
  });
  const shoeTagged = input.tags.some((tag) => /cat_shoes|women'?s shoes|chaussures?/i.test(tag));
  const official = classifyOfficialFootwear({
    title: input.title,
    productType: input.productType,
    tags: input.tags.join(", "),
  });
  if (scope.decision === "footwear" && scope.category !== "OTHER_FOOTWEAR") return { category: scope.category };
  const labeled = categoryFromLabel(`${input.title} ${input.productType} ${input.tags.join(" ")}`);
  const inShoeCollection = /shoe|footwear|chaussure|calzado|zapato|bailarina|botin|salon/.test(input.collectionHandle);
  if (official && (scope.decision === "footwear" || shoeTagged || labeled || inShoeCollection)) {
    return { category: legacyCategoryForPrimary(official) };
  }
  if (labeled && (scope.decision === "footwear" || shoeTagged || inShoeCollection)) return { category: labeled };
  const fromCollection = categoryFromLabel(input.collectionHandle.replace(/-/g, " "));
  if (fromCollection && (scope.decision === "footwear" || shoeTagged)) return { category: fromCollection };
  if (scope.decision === "footwear") return { category: scope.category };
  return { reason: scope.reason };
}

function mergeSameModel(families: WaveModelFamily[]): WaveModelFamily[] {
  const groups = new Map<string, WaveModelFamily>();
  for (const family of families) {
    const key = `${family.category}:${family.canonicalName.trim().toLowerCase()}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, family);
      continue;
    }
    const seen = new Set(existing.variants.map((variant) => variant.productUrl));
    const variants = [...existing.variants];
    for (const variant of family.variants) {
      if (seen.has(variant.productUrl)) continue;
      seen.add(variant.productUrl);
      variants.push(variant);
    }
    const images = [...new Set([...existing.images, ...family.images])];
    groups.set(key, {
      ...existing,
      images,
      variants,
      isNew: variants.some((variant) => variant.isNew),
      groupingReason: variants.length > 1 ? "handle-family" : existing.groupingReason,
    });
  }
  return [...groups.values()];
}

async function readJson(http: OfficialHttp, url: string): Promise<{ status: number; data: unknown | null; error?: string }> {
  const response = await http.fetchText(url);
  if (!response.ok) return { status: response.status, data: null, error: response.error ?? `HTTP ${response.status}` };
  try {
    return { status: response.status, data: JSON.parse(response.text) as unknown };
  } catch {
    return { status: response.status, data: null, error: "UNREADABLE_JSON" };
  }
}

export async function collectOfficialShopifyBrand(
  target: OfficialBrandTarget,
  http: OfficialHttp,
  now: string,
): Promise<OfficialCollectResult> {
  const sourceUrls = target.collections.map((collection) => collectionUrl(target, collection.handle));
  const reasons: Record<string, number> = {};
  const byId = new Map<number, { product: ShopifyProduct; sourceUrl: string }>();
  let pagesVisited = 0;
  let paginationExhausted = true;
  let storefrontProductCount = 0;
  let storefrontKnown = true;
  let collectionResourceCount = 0;
  let resourceKnown = true;
  const errors: string[] = [];

  for (const collection of target.collections) {
    const pageUrl = collectionUrl(target, collection.handle);
    pagesVisited += 1;
    const html = await http.fetchText(pageUrl);
    const displayed = html.ok ? parseStorefrontProductCount(html.text) : null;
    if (!html.ok || displayed == null) {
      storefrontKnown = false;
      errors.push(`${collection.handle}: storefront total unavailable (${html.status || displayed})`);
    } else {
      storefrontProductCount += displayed;
    }

    const resource = await readJson(http, `${pageUrl}.json`);
    pagesVisited += 1;
    const resourceCount = resource.data && typeof resource.data === "object"
      ? (resource.data as { collection?: { products_count?: number } }).collection?.products_count
      : undefined;
    if (typeof resourceCount !== "number") {
      resourceKnown = false;
    } else {
      collectionResourceCount += resourceCount;
    }

    let pageNew = 0;
    for (let page = 1; page <= OFFICIAL_PAGE_CAP; page += 1) {
      const jsonUrl = `${pageUrl}/products.json?limit=${OFFICIAL_PAGE_SIZE}&page=${page}`;
      pagesVisited += 1;
      const payload = await readJson(http, jsonUrl);
      if (!payload.data || typeof payload.data !== "object") {
        paginationExhausted = false;
        errors.push(`${collection.handle} page ${page}: ${payload.error ?? "NO_JSON"}`);
        break;
      }
      const batch = (payload.data as { products?: ShopifyProduct[] }).products ?? [];
      if (batch.length === 0) {
        if (page === 1) paginationExhausted = displayed === 0;
        break;
      }
      let added = 0;
      for (const product of batch) {
        if (typeof product.id !== "number") continue;
        if (byId.has(product.id)) continue;
        byId.set(product.id, { product, sourceUrl: pageUrl });
        added += 1;
      }
      pageNew += added;
      if (added === 0) {
        paginationExhausted = false;
        errors.push(`${collection.handle}: pagination repeated page ${page}`);
        break;
      }
      if (batch.length < OFFICIAL_PAGE_SIZE) break;
      if (page === OFFICIAL_PAGE_CAP) {
        paginationExhausted = false;
        errors.push(`${collection.handle}: PAGE_CAP`);
      }
    }
    if (pageNew === 0 && displayed !== 0) paginationExhausted = false;
  }

  const footwear: FamilyProduct[] = [];
  for (const { product, sourceUrl } of byId.values()) {
    const handle = product.handle?.trim();
    const title = product.title?.trim();
    if (!handle || !title) {
      bump(reasons, "missing-identity");
      continue;
    }
    const tags = asTags(product.tags);
    const scope = footwearCategory({
      title,
      productType: product.product_type ?? "",
      tags,
      handle,
      collectionHandle: new URL(sourceUrl).pathname.split("/").pop() ?? "",
    });
    if ("reason" in scope) {
      bump(reasons, scope.reason);
      continue;
    }
    const images = productImages(product);
    if (images.length === 0) bump(reasons, "missing-gallery");
    footwear.push({
      handle,
      productUrl: `${target.origin}${target.localePath}/products/${handle}`,
      title,
      color: colorFromOptions(product),
      sku: product.variants?.find((variant) => variant.sku)?.sku ?? null,
      images,
      category: scope.category,
      productType: product.product_type ?? "",
      tags,
      inNewArrivals: false,
      isNew: false,
      newnessEvidence: null,
    });
  }

  const galleryComplete = footwear.filter((product) => product.images.length > 0).length;
  const quarantined = byId.size - footwear.length + (footwear.length - galleryComplete);
  const families = mergeSameModel(groupColorwaysIntoFamilies(
    target.brand,
    target.slug,
    footwear.filter((product) => product.images.length > 0),
  ));
  const displayedTotal = storefrontKnown ? storefrontProductCount : null;
  const reconciled = displayedTotal != null && paginationExhausted && byId.size === displayedTotal;
  const cleanFootwear = footwear.length === byId.size && galleryComplete === footwear.length && footwear.length > 0;
  const taxonomyPassed = families.length > 0 && families.every((family) => Boolean(family.category));
  const full = reconciled && cleanFootwear && taxonomyPassed && families.every((family) => !family.isNew);
  const status = full ? "FULL" : byId.size > 0 ? "PARTIAL" : "FAILED";
  const blocker = full
    ? null
    : !storefrontKnown
      ? "STOREFRONT_TOTAL_UNKNOWN"
      : !paginationExhausted
        ? "PAGINATION_NOT_EXHAUSTED"
        : byId.size !== displayedTotal
          ? "STOREFRONT_TOTAL_NOT_RECONCILED"
          : !cleanFootwear
            ? "NON_FOOTWEAR_OR_GALLERY_GAP"
            : "TAXONOMY_OR_NEWNESS_GAP";

  const coverage = buildWaveCoverage({
    sourceTotal: full ? displayedTotal : displayedTotal,
    collected: full ? footwear.length : footwear.filter((product) => product.images.length > 0).length,
    excluded: byId.size - footwear.length,
    paginationExhausted,
    galleryComplete,
    taxonomyPassed,
    womenFootwearOnly: true,
    sampleOnly: false,
  });
  if (!full) {
    coverage.sourceTotal = displayedTotal;
    coverage.missing = displayedTotal == null ? null : Math.max(0, displayedTotal - coverage.collected);
    coverage.coverage = displayedTotal && displayedTotal > 0
      ? Math.round((coverage.collected / displayedTotal) * 10_000) / 100
      : null;
  }

  const catalog: WaveCatalog | null = full
    ? {
        slug: target.slug,
        brand: target.brand,
        officialUrl: target.origin,
        snapshotId: `${target.slug}:${now}`,
        collectedAt: now,
        catalogPaths: target.collections.map((collection) => `${target.localePath}/collections/${collection.handle}`),
        newArrivalsPaths: [],
        coverage,
        newArrivalsFootwear: 0,
        referenceFootwearTotal: displayedTotal,
        referenceNewArrivals: null,
        referenceFootwearMatch: true,
        referenceNewArrivalsMatch: null,
        families,
        productUrls: footwear.map((product) => product.productUrl),
      }
    : null;

  return {
    catalog,
    evidence: {
      slug: target.slug,
      brand: target.brand,
      sourceUrls,
      collectedAt: now,
      pagesVisited,
      storefrontProductCount: displayedTotal,
      collectionResourceCount: resourceKnown ? collectionResourceCount : null,
      fetchedProducts: byId.size,
      acceptedFootwear: footwear.filter((product) => product.images.length > 0).length,
      quarantined,
      quarantineReasons: reasons,
      modelFamilies: families.length,
      status,
      paginationExhausted,
      baselineNewArrivals: 0,
      blocker: errors.length && !full ? `${blocker}: ${errors.join("; ")}` : blocker,
      refreshCommand: target.refreshCommand ?? OFFICIAL_SHOPIFY_REFRESH_COMMAND,
      periodicRefresh: false,
      note: "Initial import is a baseline and is not marked as New Arrivals. collection.products_count is recorded separately and is not the storefront total when it disagrees. Refresh is the dedicated command, not the periodic brand line.",
    },
  };
}
