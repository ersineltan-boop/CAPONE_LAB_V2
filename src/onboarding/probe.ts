import { evaluateFootwearProduct, isVerifiedFootwearCollectionPath } from "../collector/footwearGate";
import { extractJsonLdBlocks, mapSchemaProducts } from "../collector/schemaOrg";
import { EXISTING_DEDICATED_ADAPTER_IDS } from "./policy";
import { fingerprintStorefront, looksLikeBotChallenge } from "./platforms";
import { fetchMaybeJson, type OnboardingHttp } from "./http";
import { collectFromProductUrls, discoverSitemapProductUrls } from "./sitemap";
import { probeInditexLikeCatalog } from "./inditexLike";
import type { ProbeResult, ProbeSampleProduct } from "./types";
import { JW_WOMENS_SHOES_PATH } from "../collector/jwAnderson";

const SHOPIFY_FOOTWEAR_PATHS = [
  "/collections/shoes",
  "/collections/womens-shoes",
  "/collections/women-shoes",
  "/collections/footwear",
  "/collections/all-shoes",
  "/collections/sandals",
  "/collections/boots",
];

const HTML_FOOTWEAR_PATHS = [
  "/en/shoes",
  "/us/en/shoes",
  "/woman/shoes",
  "/women/shoes",
  "/womens-shoes",
  "/footwear",
];

const INDITEX_LIKE_BRANDS = new Set([
  "massimo-dutti", "mango", "bershka", "pull-and-bear", "stradivarius", "oysho",
]);

interface ShopifyProductsResponse {
  products?: Array<{
    handle?: string;
    title?: string;
    product_type?: string;
    tags?: string[] | string;
    images?: Array<{ src?: string }>;
    variants?: Array<{ sku?: string; title?: string }>;
  }>;
}

function asTags(value: string[] | string | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : value.split(",").map((item) => item.trim());
}

export async function probeBrandSource(input: {
  slug: string;
  brand: string;
  sourceUrl: string;
  http: OnboardingHttp;
}): Promise<ProbeResult> {
  const baseUrl = input.sourceUrl.replace(/\/$/, "");
  const blockedSignals: string[] = [];

  if (EXISTING_DEDICATED_ADAPTER_IDS.has(input.slug)) {
    return {
      platform: "EXISTING CAPONE ADAPTER",
      strategy: "existing-adapter",
      status: "READY",
      sourceUrl: baseUrl,
      collectionPaths: [],
      footwearPaths: [],
      products: [],
      blocker: null,
      notes: "Dedicated CAPONE adapter already exists",
    };
  }

  const homepage = await input.http.fetchText(baseUrl, { delayMs: 300 });
  const homepageFingerprint = fingerprintStorefront({
    html: homepage.text,
    url: homepage.url,
  });
  if (!homepage.ok && looksLikeBotChallenge(homepage.text, homepage.status)) {
    blockedSignals.push(`homepage HTTP ${homepage.status}`);
  }

  const shopify = await probeShopify(input.http, baseUrl, input.brand,
    input.slug === "jw-anderson" ? [JW_WOMENS_SHOES_PATH] : undefined);
  if (shopify.products.length > 0) {
    return {
      platform: "SHOPIFY",
      strategy: "shopify-public",
      status: "VALIDATING",
      sourceUrl: baseUrl,
      collectionPaths: shopify.paths,
      footwearPaths: shopify.paths,
      products: shopify.products,
      blocker: null,
      notes: shopify.notes,
    };
  }
  if (shopify.blocked) blockedSignals.push(shopify.blocked);

  if (INDITEX_LIKE_BRANDS.has(input.slug) || homepageFingerprint.signals.includes("inditex")) {
    const inditex = await probeInditexLikeCatalog(input.http, {
      baseUrl,
      brandId: input.slug,
      brandName: input.brand,
    });
    if (inditex.ok && inditex.samples.length > 0) {
      return {
        platform: "INDITEX-LIKE PUBLIC CATALOG",
        strategy: "inditex-like-catalog",
        status: "VALIDATING",
        sourceUrl: baseUrl,
        locale: inditex.locale ?? undefined,
        collectionPaths: [],
        footwearPaths: [],
        products: inditex.samples,
        blocker: null,
        notes: `Inditex-like public catalog verified at locale ${inditex.locale}`,
      };
    }
    if (inditex.blocker) blockedSignals.push(inditex.blocker);
  }

  const sitemapUrls = await discoverSitemapProductUrls(input.http, baseUrl);
  if (sitemapUrls.length > 0) {
    const samples = await collectFromProductUrls(input.http, sitemapUrls, {
      id: input.slug,
      name: input.brand,
      baseUrl,
    });
    if (samples.length > 0) {
      return {
        platform: "SITEMAP PRODUCT CRAWL",
        strategy: "sitemap-product-crawl",
        status: "VALIDATING",
        sourceUrl: baseUrl,
        collectionPaths: [],
        footwearPaths: [],
        products: samples,
        blocker: null,
        notes: `Sitemap exposed ${sitemapUrls.length} product URLs`,
      };
    }
  }

  const structured = await probeStructuredListing(input.http, baseUrl, input.slug, input.brand);
  if (structured.products.length > 0) {
    return {
      platform: homepageFingerprint.platform === "NEXT.JS PUBLIC DATA"
        ? "NEXT.JS PUBLIC DATA"
        : "STRUCTURED-DATA CATALOG",
      strategy: "structured-data",
      status: "VALIDATING",
      sourceUrl: baseUrl,
      collectionPaths: structured.paths,
      footwearPaths: structured.paths,
      products: structured.products,
      blocker: null,
      notes: structured.notes,
    };
  }

  if (
    homepageFingerprint.platform === "SALESFORCE COMMERCE" ||
    homepageFingerprint.platform === "NEXT.JS PUBLIC DATA"
  ) {
    return {
      platform: homepageFingerprint.platform,
      strategy: homepageFingerprint.platform === "SALESFORCE COMMERCE"
        ? "salesforce-public"
        : "nextjs-public-data",
      status: "CUSTOM_ADAPTER_REQUIRED",
      sourceUrl: baseUrl,
      collectionPaths: [],
      footwearPaths: [],
      products: [],
      blocker:
        "Public storefront fingerprint found, but generic CAPONE collectors cannot safely model this catalog yet",
      notes: homepageFingerprint.signals.join(", "),
    };
  }

  if (blockedSignals.length > 0 && !homepage.ok) {
    return {
      platform: homepageFingerprint.platform,
      strategy: "none",
      status: "PRIORITY_BLOCKED",
      sourceUrl: baseUrl,
      collectionPaths: [],
      footwearPaths: [],
      products: [],
      blocker: blockedSignals.join("; "),
      notes: "Homepage/catalog routes were blocked. Sitemap and public JSON were tried first.",
    };
  }

  return {
    platform: homepageFingerprint.platform,
    strategy: "none",
    status: "CUSTOM_ADAPTER_REQUIRED",
    sourceUrl: baseUrl,
    collectionPaths: [],
    footwearPaths: [],
    products: [],
    blocker:
      shopify.notes ??
      "No reusable public collector strategy produced women's footwear products",
    notes: blockedSignals.join("; ") || homepageFingerprint.signals.join(", ") || null,
  };
}

async function probeShopify(
  http: OnboardingHttp,
  baseUrl: string,
  brand: string,
  verifiedPaths?: readonly string[],
): Promise<{ products: ProbeSampleProduct[]; paths: string[]; notes: string | null; blocked: string | null }> {
  const paths = [...(verifiedPaths ?? SHOPIFY_FOOTWEAR_PATHS)];
  const samples: ProbeSampleProduct[] = [];
  let blocked: string | null = null;

  const allJson = verifiedPaths ? { status: 0, json: null } : await fetchMaybeJson(http, `${baseUrl}/products.json?limit=8`, 300);
  if (allJson.status === 403 || allJson.status === 401) {
    blocked = `Shopify products.json HTTP ${allJson.status}`;
  }
  const payloads: Array<{ json: ShopifyProductsResponse | null; path: string }> = [
    { json: (allJson.json as ShopifyProductsResponse | null) ?? null, path: "/products.json" },
  ];
  for (const path of paths.slice(0, 4)) {
    const listing = await fetchMaybeJson(http, `${baseUrl}${path}/products.json?limit=8`, 250);
    if (listing.status === 403) blocked = `Shopify ${path} HTTP 403`;
    payloads.push({ json: (listing.json as ShopifyProductsResponse | null) ?? null, path });
  }

  for (const payload of payloads) {
    for (const product of payload.json?.products ?? []) {
      const handle = product.handle?.trim();
      const title = product.title?.trim();
      if (!handle || !title) continue;
      const gate = evaluateFootwearProduct({
        title,
        productType: product.product_type,
        tags: asTags(product.tags),
        handle,
        collectionPath: payload.path,
        fromVerifiedFootwearCollection: isVerifiedFootwearCollectionPath(payload.path),
      });
      if (gate.decision !== "ACCEPT_FOOTWEAR") continue;
      const images = (product.images ?? []).map((image) => image.src).filter((src): src is string => Boolean(src));
      samples.push({
        productUrl: `${baseUrl}/products/${handle}`,
        productName: title,
        imageUrl: images[0] ?? null,
        images,
        color: null,
        sku: product.variants?.find((variant) => variant.sku)?.sku ?? null,
        sourceCategoryName: product.product_type ?? null,
      });
    }
  }

  return {
    products: samples.slice(0, 12),
    paths: samples.length > 0 ? paths : [],
    notes: samples.length > 0 ? `${brand}: Shopify public products.json` : "Shopify products.json did not yield women's footwear",
    blocked,
  };
}

async function probeStructuredListing(
  http: OnboardingHttp,
  baseUrl: string,
  slug: string,
  brand: string,
): Promise<{ products: ProbeSampleProduct[]; paths: string[]; notes: string | null }> {
  const samples: ProbeSampleProduct[] = [];
  const used: string[] = [];
  for (const path of HTML_FOOTWEAR_PATHS) {
    const page = await http.fetchText(`${baseUrl}${path}`, { delayMs: 300 });
    if (!page.ok) continue;
    const blocks = extractJsonLdBlocks(page.text);
    if (blocks.length === 0) continue;
    const mapped = mapSchemaProducts(
      page.text,
      {
        id: slug,
        brand,
        baseUrl,
        collectionPaths: [path],
        maxProducts: 8,
      },
      new Date().toISOString(),
      page.url,
    );
    const accepted = mapped.filter((product) => {
      const gate = evaluateFootwearProduct({
        title: product.productName,
        productType: product.category ?? "",
        handle: product.productUrl,
        collectionPath: path,
      });
      return gate.decision === "ACCEPT_FOOTWEAR";
    });
    if (accepted.length === 0) continue;
    used.push(path);
    for (const product of accepted) {
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
    if (samples.length >= 6) break;
  }
  return {
    products: samples.slice(0, 12),
    paths: used,
    notes: samples.length > 0 ? "JSON-LD product data on public footwear paths" : null,
  };
}
