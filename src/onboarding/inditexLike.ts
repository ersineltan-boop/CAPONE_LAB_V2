import {
  collectZaraImageUrls,
  extractZaraCommercialComponents,
  parseZaraCategoryTree,
  zaraColorNames,
  type ZaraCategoryNode,
} from "../collector/zara";
import { evaluateFootwearProduct } from "../collector/footwearGate";
import { mergeProductCatalog } from "../collector/mergeProducts";
import { isNewArrivalsCollectionPath, detectNewBadgeInText } from "../newArrivals/detectNewness";
import { slugifyCategoryId } from "../source/sourceCategories";
import type { CollectionAttemptResult } from "../collector/collectWithFallback";
import type { PilotProduct } from "../collector/types";
import type { BrandRegistryEntry } from "../registry/types/brand";
import { fetchMaybeJson, type OnboardingHttp } from "./http";
import type { ProbeSampleProduct } from "./types";

const JSON_HEADERS = {
  Accept: "application/json",
  "X-Requested-With": "XMLHttpRequest",
};

const MENS_OR_KIDS = /\b(man|men|hombre|kid|ninos|niños|boy|girl|baby|toddler|mini)\b/i;
const MIXED_OR_NON_FOOTWEAR =
  /bag|handbag|accessories|fragrance|beauty|home|gilet|vest|suit|dress|ready to wear/i;

export interface InditexLikeConfig {
  baseUrl: string;
  locale: string;
  brandId: string;
  brandName: string;
}

function flattenCategories(nodes: ZaraCategoryNode[]): ZaraCategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.subcategories)]);
}

export function selectInditexWomensFootwearCategories(
  tree: ZaraCategoryNode[],
): ZaraCategoryNode[] {
  const woman = tree.find(
    (node) =>
      node.sectionName === "WOMAN" ||
      node.name.toUpperCase() === "WOMAN" ||
      /mujer|woman|femme|donna/i.test(`${node.name} ${node.key ?? ""}`),
  );
  if (!woman) return [];

  const shoesRoots = flattenCategories([woman]).filter((node) => {
    const label = `${node.name} ${node.key ?? ""}`;
    if (MENS_OR_KIDS.test(node.path.join(" "))) return false;
    return /^(shoes|shoe|footwear|zapatos|chaussures|scarpe)$/i.test(node.name.trim()) ||
      /shoes|footwear|zapatos/i.test(label);
  });
  if (shoesRoots.length === 0) return [];

  return shoesRoots.flatMap((root) =>
    flattenCategories([root]).filter((node) => {
      if (MENS_OR_KIDS.test(node.path.join(" "))) return false;
      if (MIXED_OR_NON_FOOTWEAR.test(node.name) && !/^shoes$/i.test(node.name) && !/view all/i.test(node.name)) {
        return false;
      }
      return true;
    }),
  );
}

export function buildInditexCategoryUrl(config: InditexLikeConfig, category: ZaraCategoryNode): string {
  const keyword = category.seoKeyword ?? "woman-shoes";
  const seoId = category.seoCategoryId ?? category.id;
  return `${config.baseUrl}/${config.locale}/${keyword}-l${seoId}.html`;
}

export function buildInditexProductUrl(
  config: InditexLikeConfig,
  seo: { keyword?: string; seoProductId?: string | number; irrelevant?: boolean } | undefined,
  fallbackId?: string | number,
): string | null {
  const keyword = seo?.keyword?.trim();
  const seoProductId = String(seo?.seoProductId ?? "").trim() || String(fallbackId ?? "").trim();
  if (!keyword || !seoProductId || seo?.irrelevant) return null;
  return `${config.baseUrl}/${config.locale}/${keyword}-p${seoProductId}.html`;
}

export function inditexComponentToProduct(
  component: ReturnType<typeof extractZaraCommercialComponents>[number],
  category: ZaraCategoryNode,
  config: InditexLikeConfig,
  discoveredAt: string,
): PilotProduct | null {
  const name = component.name?.trim();
  const productUrl = buildInditexProductUrl(config, component.seo, component.id);
  if (!name || !productUrl) return null;

  const gate = evaluateFootwearProduct({
    title: name,
    productType: [component.familyName, component.subfamilyName, category.name].filter(Boolean).join(" "),
    tags: [component.sectionName, category.path.join(" ")].filter(
      (tag): tag is string => Boolean(tag),
    ),
    handle: component.seo?.keyword,
    collectionPath: new URL(buildInditexCategoryUrl(config, category)).pathname,
    fromVerifiedFootwearCollection: true,
  });
  if (gate.decision !== "ACCEPT_FOOTWEAR" || !gate.category) return null;

  const images = collectZaraImageUrls({
    xmedia: component.xmedia,
    detail: component.detail,
  });
  const colors = zaraColorNames(component);
  const displayReference = component.detail?.displayReference?.trim() || null;
  const styleSku =
    (displayReference ? `${config.brandId.toUpperCase()}-REF-${displayReference}` : String(component.reference ?? "").trim()) ||
    null;
  const tags = (component.productTag ?? []).flatMap((tag) =>
    typeof tag === "string" ? [tag] : [tag.type, tag.name].filter(Boolean),
  );
  const collectionPath = new URL(buildInditexCategoryUrl(config, category)).pathname;
  const isNewCollection =
    isNewArrivalsCollectionPath(collectionPath) || isNewArrivalsCollectionPath(category.path.join("/"));
  const hasNewBadge = detectNewBadgeInText(...tags);

  return {
    source: config.brandId,
    brand: config.brandName,
    productName: name,
    productUrl,
    imageUrl: images[0] ?? null,
    images,
    category: gate.category,
    color: colors[0] ?? null,
    material: null,
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: component.subfamilyName ?? component.familyName ?? null,
    discoveredAt,
    collectionPath,
    collectionLabel: category.name,
    sourceCategoryId: slugifyCategoryId(category.name),
    sourceCategoryName: category.name,
    sourceCategoryPath: collectionPath,
    sourceCategoryUrl: buildInditexCategoryUrl(config, category),
    sourceCategories: [
      {
        categoryId: slugifyCategoryId(category.name),
        categoryName: category.name,
        categoryPath: collectionPath,
        categoryUrl: buildInditexCategoryUrl(config, category),
      },
    ],
    isNewArrivalsCollection: isNewCollection,
    hasNewBadge,
    variants: (colors.length ? colors : [null]).map((color) => ({
      title: color ? `${name} ${color}` : name,
      color,
      sku: styleSku,
      imageUrl: images[0] ?? null,
      images,
    })),
  };
}

export const INDITEX_LOCALE_CANDIDATES = [
  "us/en",
  "gb/en",
  "en",
  "us",
  "ww/en",
];

export async function probeInditexLikeCatalog(
  http: OnboardingHttp,
  config: Omit<InditexLikeConfig, "locale">,
): Promise<{
  ok: boolean;
  locale: string | null;
  categories: ZaraCategoryNode[];
  samples: ProbeSampleProduct[];
  blocker: string | null;
}> {
  for (const locale of INDITEX_LOCALE_CANDIDATES) {
    const catalogUrl = `${config.baseUrl}/${locale}/categories?ajax=true`;
    const catalog = await fetchMaybeJson(http, catalogUrl, 350, JSON_HEADERS);
    if (!catalog.ok || !catalog.json) continue;
    const tree = parseZaraCategoryTree(catalog.json);
    if (tree.length === 0) continue;
    const footwear = selectInditexWomensFootwearCategories(tree);
    if (footwear.length === 0) continue;

    const fullConfig: InditexLikeConfig = { ...config, locale };
    const samples: ProbeSampleProduct[] = [];
    for (const category of footwear.slice(0, 3)) {
      const productsUrl = `${config.baseUrl}/${locale}/category/${category.id}/products?ajax=true`;
      const listing = await fetchMaybeJson(http, productsUrl, 400, JSON_HEADERS);
      if (!listing.ok || !listing.json) continue;
      const mapped = extractZaraCommercialComponents(listing.json)
        .map((component) =>
          inditexComponentToProduct(component, category, fullConfig, new Date().toISOString()),
        )
        .filter((item): item is PilotProduct => Boolean(item));
      for (const product of mapped.slice(0, 6)) {
        samples.push({
          productUrl: product.productUrl,
          productName: product.productName,
          imageUrl: product.imageUrl,
          images: product.images ?? [],
          color: product.color,
          sku: product.variants.find((variant) => variant.sku)?.sku ?? null,
          sourceCategoryName: product.sourceCategoryName ?? null,
        });
      }
      if (samples.length >= 4) break;
    }

    if (samples.length === 0) {
      return {
        ok: false,
        locale,
        categories: footwear,
        samples: [],
        blocker:
          "Inditex-like category tree found but women's footwear products/URLs could not be mapped from the public catalog JSON",
      };
    }

    return { ok: true, locale, categories: footwear, samples, blocker: null };
  }

  return {
    ok: false,
    locale: null,
    categories: [],
    samples: [],
    blocker: "No Inditex-like public categories?ajax=true catalog was accessible",
  };
}

export async function collectInditexLikeCatalog(
  http: OnboardingHttp,
  config: InditexLikeConfig,
): Promise<CollectionAttemptResult> {
  const discoveredAt = new Date().toISOString();
  const catalog = await fetchMaybeJson(
    http,
    `${config.baseUrl}/${config.locale}/categories?ajax=true`,
    400,
    JSON_HEADERS,
  );
  const errors: string[] = catalog.ok ? [] : [`HTTP ${catalog.status} for categories`];
  const tree = catalog.json ? parseZaraCategoryTree(catalog.json) : [];
  const categories = selectInditexWomensFootwearCategories(tree);
  const collected: PilotProduct[] = [];
  const discoveredLinks = new Set<string>();

  for (const category of categories.slice(0, 12)) {
    const listing = await fetchMaybeJson(
      http,
      `${config.baseUrl}/${config.locale}/category/${category.id}/products?ajax=true`,
      500,
      JSON_HEADERS,
    );
    if (!listing.ok || !listing.json) {
      errors.push(`${category.name}: HTTP ${listing.status}`);
      continue;
    }
    const mapped = extractZaraCommercialComponents(listing.json)
      .map((component) => inditexComponentToProduct(component, category, config, discoveredAt))
      .filter((item): item is PilotProduct => Boolean(item));
    for (const product of mapped) discoveredLinks.add(product.productUrl);
    collected.push(...mapped);
    if (mapped.length === 0) {
      const ajax = await fetchMaybeJson(
        http,
        `${buildInditexCategoryUrl(config, category)}?ajax=true`,
        400,
        JSON_HEADERS,
      );
      if (ajax.ok && ajax.json) {
        const extra = extractZaraCommercialComponents(ajax.json)
          .map((component) => inditexComponentToProduct(component, category, config, discoveredAt))
          .filter((item): item is PilotProduct => Boolean(item));
        for (const product of extra) discoveredLinks.add(product.productUrl);
        collected.push(...extra);
      }
    }
  }

  const merged = mergeProductCatalog([], collected);
  return {
    products: merged,
    discoveredLinks,
    errors,
    method: "custom-adapter",
    // This adapter probes a bounded subset and has no authoritative footwear total.
    // It must remain PARTIAL until a complete source-specific adapter proves coverage.
    paginationExhausted: false,
    sourceReportedProductCount: null,
    hitCollectionCrawlCap: categories.length > 12,
    rawProductUrlsDiscovered: discoveredLinks.size,
  };
}

export async function collectInditexLikeBrand(
  entry: BrandRegistryEntry,
  http: OnboardingHttp,
  locale = "us/en",
): Promise<CollectionAttemptResult> {
  const baseUrl = (entry.officialUrl ?? "").replace(/\/$/, "");
  if (!baseUrl) {
    return {
      products: [],
      discoveredLinks: new Set(),
      errors: [`${entry.brand}: officialUrl missing`],
      method: "none",
    };
  }
  return collectInditexLikeCatalog(http, {
    baseUrl,
    locale,
    brandId: entry.id,
    brandName: entry.brand,
  });
}
