import { fetchText } from "./http";
import type { CollectionDiscoveryStatus } from "../registry/types/brand";
import {
  evaluateFootwearProduct,
  isFootwearCollectionPath,
  isVerifiedFootwearCollectionPath,
} from "./footwearGate";

export type { CollectionDiscoveryStatus };

interface ShopifyProductsResponse {
  products?: Array<{
    title: string;
    handle: string;
    product_type?: string;
    tags?: string[] | string;
  }>;
}

function normalizeTags(tags: string[] | string | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return tags.split(",").map((tag) => tag.trim());
}

export interface FootwearCollectionCandidate {
  path: string;
  handle: string;
  url: string;
  footwearRatio: number;
  sampleSize: number;
  acceptedCount: number;
  excludedNonFootwear: number;
  excludedUncertain: number;
  womensScore: number;
  qualityStatus: "VERIFIED" | "AUTO_DISCOVERED" | "REJECT";
}

export interface FootwearCollectionDiscoveryResult {
  status: CollectionDiscoveryStatus;
  verifiedPaths: string[];
  handles: string[];
  urls: string[];
  candidates: FootwearCollectionCandidate[];
}

const SAMPLE_SIZE = 10;
const VERIFIED_MIN_ACCEPTED = 8;
const AUTO_DISCOVERED_MIN_ACCEPTED = 5;
const AUTO_DISCOVERED_MIN_RATIO = 0.5;

const FOOTWEAR_COLLECTION_FALLBACKS = [
  "/collections/womens-shoes",
  "/collections/women-shoes",
  "/collections/womens-shoes-1",
  "/collections/shoes",
  "/collections/footwear",
  "/collections/women-footwear",
  "/collections/womens-footwear",
  "/collections/shoes-women",
  "/collections/shop-all",
  "/collections/view-all",
  "/collections/all-shoes",
  "/collections/shoes-view-all",
  "/collections/new-shoes",
  "/collections/new-arrivals-shoes",
  "/collections/heels",
  "/collections/flats",
  "/collections/sandals",
  "/collections/boots",
  "/en/collections/womens-shoes",
  "/en/collections/shoes",
  "/en/collections/footwear",
];

const COLLECTION_HREF =
  /href=["']([^"']*(?:\/collections\/[^"'#?]+|\/en(?:-[a-z]{2})?\/collections\/[^"'#?]+))["']/gi;

const WOMENS_COLLECTION_HINT =
  /women'?s?|womens|femme|ladies|woman|girl/i;

function normalizePath(href: string, baseUrl: string): string | null {
  try {
    const absolute = href.startsWith("http") ? new URL(href) : new URL(href, baseUrl);
    if (absolute.origin !== new URL(baseUrl).origin) return null;
    return absolute.pathname.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function scoreWomensCollectionPath(path: string): number {
  const normalized = path.toLowerCase();
  if (WOMENS_COLLECTION_HINT.test(normalized)) return 3;
  if (/\bmen'?s?\b|\bmens\b|\bhomme\b/.test(normalized)) return -2;
  if (isFootwearCollectionPath(normalized)) return 1;
  return 0;
}

function classifyCandidateQuality(
  acceptedCount: number,
  sampleSize: number,
): FootwearCollectionCandidate["qualityStatus"] {
  if (sampleSize === 0) return "REJECT";
  const ratio = acceptedCount / sampleSize;
  if (acceptedCount >= VERIFIED_MIN_ACCEPTED && ratio >= 0.8) return "VERIFIED";
  if (
    acceptedCount >= AUTO_DISCOVERED_MIN_ACCEPTED &&
    ratio >= AUTO_DISCOVERED_MIN_RATIO
  ) {
    return "AUTO_DISCOVERED";
  }
  return "REJECT";
}

async function discoverCollectionPathsFromHomepage(baseUrl: string): Promise<string[]> {
  const response = await fetchText(baseUrl.replace(/\/$/, ""), { delayMs: 900 });
  const paths = new Set<string>();

  if (response.ok) {
    for (const match of response.text.matchAll(COLLECTION_HREF)) {
      const path = normalizePath(match[1] ?? "", baseUrl);
      if (path && isFootwearCollectionPath(path)) paths.add(path);
    }
  }

  for (const fallback of FOOTWEAR_COLLECTION_FALLBACKS) {
    paths.add(fallback);
  }

  return [...paths].sort((a, b) => scoreWomensCollectionPath(b) - scoreWomensCollectionPath(a));
}

async function fetchCollectionSample(
  baseUrl: string,
  path: string,
): Promise<ShopifyProductsResponse["products"]> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}/products.json?limit=${SAMPLE_SIZE}`;
  const response = await fetchText(url, { delayMs: 900 });
  if (!response.ok) return [];

  try {
    const parsed = JSON.parse(response.text) as ShopifyProductsResponse;
    return parsed.products ?? [];
  } catch {
    return [];
  }
}

async function scoreCollectionPath(
  baseUrl: string,
  path: string,
): Promise<FootwearCollectionCandidate | null> {
  const products = await fetchCollectionSample(baseUrl, path);
  if (!products || products.length === 0) return null;

  let acceptedCount = 0;
  let excludedNonFootwear = 0;
  let excludedUncertain = 0;

  for (const product of products.slice(0, SAMPLE_SIZE)) {
    const gate = evaluateFootwearProduct({
      title: product.title,
      productType: product.product_type ?? "",
      tags: normalizeTags(product.tags),
      handle: product.handle,
      collectionPath: path,
      fromVerifiedFootwearCollection: isVerifiedFootwearCollectionPath(path),
    });

    if (gate.decision === "ACCEPT_FOOTWEAR") acceptedCount += 1;
    else if (gate.decision === "EXCLUDE_NON_FOOTWEAR") excludedNonFootwear += 1;
    else excludedUncertain += 1;
  }

  const sampleSize = Math.min(products.length, SAMPLE_SIZE);
  const footwearRatio = sampleSize > 0 ? acceptedCount / sampleSize : 0;
  const handle = path.split("/").pop() ?? path;
  const qualityStatus = classifyCandidateQuality(acceptedCount, sampleSize);

  return {
    path,
    handle,
    url: `${baseUrl.replace(/\/$/, "")}${path}`,
    footwearRatio,
    sampleSize,
    acceptedCount,
    excludedNonFootwear,
    excludedUncertain,
    womensScore: scoreWomensCollectionPath(path),
    qualityStatus,
  };
}

export async function discoverVerifiedFootwearCollections(input: {
  baseUrl: string;
  existingPaths?: string[];
  maxCandidates?: number;
  fullCoverage?: boolean;
}): Promise<FootwearCollectionDiscoveryResult> {
  const discovered =
    input.existingPaths && input.existingPaths.length > 0
      ? input.existingPaths
      : await discoverCollectionPathsFromHomepage(input.baseUrl);

  const uniquePaths = [...new Set(discovered)].slice(0, input.maxCandidates ?? 16);
  const candidates: FootwearCollectionCandidate[] = [];

  for (const path of uniquePaths) {
    const scored = await scoreCollectionPath(input.baseUrl, path);
    if (scored) candidates.push(scored);
  }

  candidates.sort((a, b) => {
    if (a.qualityStatus !== b.qualityStatus) {
      const rank = { VERIFIED: 3, AUTO_DISCOVERED: 2, REJECT: 1 };
      return rank[b.qualityStatus] - rank[a.qualityStatus];
    }
    if (b.womensScore !== a.womensScore) return b.womensScore - a.womensScore;
    if (b.footwearRatio !== a.footwearRatio) return b.footwearRatio - a.footwearRatio;
    return b.acceptedCount - a.acceptedCount;
  });

  const verified = candidates.filter((candidate) => candidate.qualityStatus === "VERIFIED");
  const autoDiscovered = candidates.filter(
    (candidate) => candidate.qualityStatus === "AUTO_DISCOVERED",
  );
  const hasRejectedCandidates = candidates.some(
    (candidate) => candidate.qualityStatus === "REJECT" && candidate.sampleSize > 0,
  );

  const selected =
    input.fullCoverage === true
      ? verified.length > 0
        ? verified
        : autoDiscovered
      : verified.length > 0
        ? verified.slice(0, 2)
        : autoDiscovered.length > 0
          ? autoDiscovered.slice(0, 2)
          : [];

  let status: CollectionDiscoveryStatus;
  if (verified.length > 0) {
    status = "VERIFIED";
  } else if (autoDiscovered.length > 0) {
    status = "AUTO_DISCOVERED";
  } else if (candidates.length === 0) {
    status = "NOT_FOUND";
  } else if (hasRejectedCandidates) {
    status = "NEEDS_MANUAL_CONFIG";
  } else {
    status = "UNKNOWN";
  }

  return {
    status,
    verifiedPaths: selected.map((candidate) => candidate.path),
    handles: selected.map((candidate) => candidate.handle),
    urls: selected.map((candidate) => candidate.url),
    candidates,
  };
}

export function pickPreferredFootwearCollectionPaths(
  footwearHandles: readonly string[] | undefined,
  footwearPaths: readonly string[] | undefined,
  fallbackPaths: readonly string[],
): string[] {
  if (footwearPaths && footwearPaths.length > 0) return [...footwearPaths];
  if (footwearHandles && footwearHandles.length > 0) {
    return footwearHandles.map((handle) =>
      handle.startsWith("/") ? handle : `/collections/${handle}`,
    );
  }
  const footwearFallbacks = fallbackPaths.filter((path) => isFootwearCollectionPath(path));
  return footwearFallbacks.length > 0 ? [...footwearFallbacks] : [...fallbackPaths];
}
