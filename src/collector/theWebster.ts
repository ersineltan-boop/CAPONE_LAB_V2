import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { fetchJson, fetchText, sleep } from "./http";
import { mergeProductCatalog } from "./mergeProducts";
import { shopifyProductToPilot } from "./shopify";
import type { PilotProduct, PilotSourceConfig } from "./types";

export const THE_WEBSTER_ID = "the-webster";
export const THE_WEBSTER_BASE_URL = "https://thewebster.com";
export const THE_WEBSTER_WOMEN_SHOES_PATH = "/collections/women-shoes";
export const THE_WEBSTER_WOMEN_SHOES_URL =
  `${THE_WEBSTER_BASE_URL}${THE_WEBSTER_WOMEN_SHOES_PATH}`;

const PAGE_SIZE = 250;
const MAX_PAGES = 20;
const EXCLUDED_BRANDS = new Set([
  "adidas",
  "converse",
  "hoka",
  "hoka one one",
  "nike",
  "on",
  "on running",
  "salomon",
]);

export interface TheWebsterRawProduct {
  id: number;
  title: string;
  handle: string;
  vendor?: string;
  body_html?: string;
  product_type?: string;
  tags?: string[] | string;
  images?: Array<{ src?: string }>;
  variants?: Array<{
    title: string;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
    sku?: string | null;
    featured_image?: { src?: string } | null;
  }>;
  options?: Array<{ name: string; values: string[] }>;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface ShopifyProductsResponse {
  products?: TheWebsterRawProduct[];
}

export interface TheWebsterCoverage {
  source: typeof THE_WEBSTER_ID;
  sourceUrl: string;
  sourceTotal: number | null;
  rawCollected: number;
  excludedByPolicy: number;
  eligibleTotal: number | null;
  collected: number;
  missing: number | null;
  coverage: number | null;
  productsWithImages: number;
  verifiedNewProducts: number;
  pagesTraversed: number;
  paginationExhausted: boolean;
  status: "FULL" | "PARTIAL" | "FAILED";
  sourceUnavailable: boolean;
  errors: string[];
  excludedBrands: string[];
  collectedAt: string;
}

export interface TheWebsterCollectResult {
  products: PilotProduct[];
  coverage: TheWebsterCoverage;
}

function normalizeBrand(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function isTheWebsterExcludedBrand(brand: string | undefined): boolean {
  return EXCLUDED_BRANDS.has(normalizeBrand(brand).toLowerCase());
}

export function parseTheWebsterSourceTotal(html: string): number | null {
  const match =
    /Filter\s*&\s*Sort\s*-\s*([\d,]+)\s+Products/i.exec(html) ??
    /([\d,]+)\s+Results/i.exec(html);
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function theWebsterRawProductToPilot(
  raw: TheWebsterRawProduct,
  discoveredAt: string,
): PilotProduct | null {
  const vendor = normalizeBrand(raw.vendor);
  if (!vendor || isTheWebsterExcludedBrand(vendor)) return null;

  const config: PilotSourceConfig = {
    id: THE_WEBSTER_ID,
    brand: vendor,
    baseUrl: THE_WEBSTER_BASE_URL,
    collectionPaths: [THE_WEBSTER_WOMEN_SHOES_PATH],
    verifiedFootwearPaths: [THE_WEBSTER_WOMEN_SHOES_PATH],
    maxProducts: 10_000,
    collectMode: "full",
  };

  const product = shopifyProductToPilot(
    raw,
    config,
    discoveredAt,
    THE_WEBSTER_WOMEN_SHOES_PATH,
    "Women's Shoes",
  );
  if (!product) return null;

  return {
    ...product,
    source: THE_WEBSTER_ID,
    brand: vendor,
    isNewArrivalsCollection: false,
    hasNewBadge: false,
  };
}

export async function collectTheWebster(): Promise<TheWebsterCollectResult> {
  const collectedAt = new Date().toISOString();
  const errors: string[] = [];
  let sourceTotal: number | null = null;

  const listing = await fetchText(THE_WEBSTER_WOMEN_SHOES_URL, { delayMs: 300 });
  if (listing.ok) {
    sourceTotal = parseTheWebsterSourceTotal(listing.text);
  } else {
    errors.push(listing.error ?? `Unable to read ${THE_WEBSTER_WOMEN_SHOES_URL}`);
  }

  const rawByHandle = new Map<string, TheWebsterRawProduct>();
  let pagesTraversed = 0;
  let paginationExhausted = false;
  let firstPageUnavailable = false;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url =
      `${THE_WEBSTER_WOMEN_SHOES_URL}/products.json?limit=${PAGE_SIZE}&page=${page}`;
    const response = await fetchJson<ShopifyProductsResponse>(url, page === 1 ? 300 : 700);
    if (!response.ok || !response.data) {
      errors.push(response.error ?? `Unable to read ${url}`);
      if (page === 1) firstPageUnavailable = true;
      break;
    }

    const batch = response.data.products ?? [];
    if (batch.length === 0) {
      paginationExhausted = true;
      break;
    }
    pagesTraversed = page;
    for (const raw of batch) {
      if (!raw.handle) continue;
      rawByHandle.set(raw.handle, raw);
    }
    if (batch.length < PAGE_SIZE) {
      paginationExhausted = true;
      break;
    }
    await sleep(500);
  }

  const excludedBrands = new Set<string>();
  let excludedByPolicy = 0;
  const mapped: PilotProduct[] = [];
  for (const raw of rawByHandle.values()) {
    if (isTheWebsterExcludedBrand(raw.vendor)) {
      excludedByPolicy += 1;
      excludedBrands.add(normalizeBrand(raw.vendor));
      continue;
    }
    const product = theWebsterRawProductToPilot(raw, collectedAt);
    if (product) mapped.push(product);
  }

  const products = mergeProductCatalog([], mapped);
  const rawCollected = rawByHandle.size;
  const eligibleTotal =
    sourceTotal == null ? null : Math.max(0, sourceTotal - excludedByPolicy);
  const missing =
    eligibleTotal == null ? null : Math.max(0, eligibleTotal - products.length);
  const coverage =
    eligibleTotal == null
      ? null
      : eligibleTotal === 0
        ? 1
        : Math.min(1, products.length / eligibleTotal);

  let status: TheWebsterCoverage["status"] = "PARTIAL";
  if (firstPageUnavailable || rawCollected === 0) {
    status = "FAILED";
  } else if (
    paginationExhausted &&
    sourceTotal != null &&
    rawCollected >= sourceTotal &&
    missing === 0
  ) {
    status = "FULL";
  }

  return {
    products,
    coverage: {
      source: THE_WEBSTER_ID,
      sourceUrl: THE_WEBSTER_WOMEN_SHOES_URL,
      sourceTotal,
      rawCollected,
      excludedByPolicy,
      eligibleTotal,
      collected: products.length,
      missing,
      coverage,
      productsWithImages: products.filter(
        (product) => Boolean(product.imageUrl) || (product.images?.length ?? 0) > 0,
      ).length,
      verifiedNewProducts: 0,
      pagesTraversed,
      paginationExhausted,
      status,
      sourceUnavailable: status === "FAILED",
      errors,
      excludedBrands: [...excludedBrands].sort(),
      collectedAt,
    },
  };
}

export async function publishTheWebsterStaging(
  stagingDirectory: string,
  result: TheWebsterCollectResult,
): Promise<{ published: boolean; reason: string | null }> {
  await mkdir(stagingDirectory, { recursive: true });
  const runReportPath = `${stagingDirectory}/latest-run-report.json`;
  await atomicWriteJson(runReportPath, result.coverage);

  if (result.coverage.status !== "FULL") {
    return {
      published: false,
      reason: `Coverage is ${result.coverage.status}; last-good staging catalog preserved.`,
    };
  }

  await atomicWriteJson(`${stagingDirectory}/catalog.json`, result.products);
  await atomicWriteJson(`${stagingDirectory}/last-good-report.json`, result.coverage);
  return { published: true, reason: null };
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const body = `${JSON.stringify(value, null, 2)}\n`;
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, body, "utf8");
  await rename(temporary, path);
}
