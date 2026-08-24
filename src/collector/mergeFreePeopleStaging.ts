import { extractFreePeopleStyleNumber, listingIdentityKey } from "../modelFamily/sourceIdentity";
import type { RawAnalyzedProduct } from "../modelFamily/types";
import { mergeProductRecords, normalizeProductUrl } from "./mergeProducts";
import type { PilotProduct } from "./types";
import { FREE_PEOPLE_ID } from "./freePeople";

const PROTECTED_MARKETPLACE_SOURCES = new Set(["farfetch", "level-shoes", "mytheresa"]);

export interface FreePeopleMergeSkip {
  identity: string;
  productUrl: string;
  brand: string;
  reason: string;
}

export interface FreePeopleMergeResult {
  products: PilotProduct[];
  added: number;
  replaced: number;
  skipped: FreePeopleMergeSkip[];
}

export function freePeopleCatalogIdentity(product: Pick<PilotProduct, "productUrl" | "imageUrl" | "images" | "variants">): string | null {
  const styleNumber = extractFreePeopleStyleNumber(product);
  return styleNumber ? `${FREE_PEOPLE_ID}:${styleNumber}` : null;
}

function catalogIdentity(product: PilotProduct): string {
  return listingIdentityKey(product as unknown as RawAnalyzedProduct);
}

function asFreePeopleProduct(product: PilotProduct): PilotProduct {
  return {
    ...product,
    source: FREE_PEOPLE_ID,
  };
}

/**
 * Merge validated Free People staging products into the production catalog.
 * Official, Farfetch, and Level Shoes records are never overwritten or identity-merged.
 * Replacing existing free-people identities in place makes the merge idempotent.
 */
export function mergeFreePeopleStagingIntoCatalog(
  existing: readonly PilotProduct[],
  staging: readonly PilotProduct[],
): FreePeopleMergeResult {
  const kept = existing.filter((product) => product.source !== FREE_PEOPLE_ID);
  const priorFreePeople = existing.filter((product) => product.source === FREE_PEOPLE_ID);
  const priorByIdentity = new Map<string, PilotProduct>();
  for (const product of priorFreePeople) {
    const identity = freePeopleCatalogIdentity(product) ?? catalogIdentity(asFreePeopleProduct(product));
    priorByIdentity.set(identity, product);
  }

  const protectedIdentities = new Set(kept.map((product) => catalogIdentity(product)));
  const protectedUrls = new Set(kept.map((product) => normalizeProductUrl(product.productUrl)));

  const incomingByIdentity = new Map<string, PilotProduct>();
  const skipped: FreePeopleMergeSkip[] = [];

  for (const raw of staging) {
    const product = asFreePeopleProduct(raw);
    if (PROTECTED_MARKETPLACE_SOURCES.has(raw.source)) {
      skipped.push({
        identity: catalogIdentity(raw),
        productUrl: raw.productUrl,
        brand: raw.brand,
        reason: `refusing source=${raw.source}`,
      });
      continue;
    }
    const identity = freePeopleCatalogIdentity(product);
    if (!identity) {
      skipped.push({
        identity: catalogIdentity(product),
        productUrl: product.productUrl,
        brand: product.brand,
        reason: "missing free-people styleNumber identity",
      });
      continue;
    }
    if (protectedIdentities.has(identity)) {
      skipped.push({
        identity,
        productUrl: product.productUrl,
        brand: product.brand,
        reason: "identity collides with a non-free-people catalog record",
      });
      continue;
    }
    if (protectedUrls.has(normalizeProductUrl(product.productUrl))) {
      skipped.push({
        identity,
        productUrl: product.productUrl,
        brand: product.brand,
        reason: "URL collides with a non-free-people catalog record",
      });
      continue;
    }

    const priorIncoming = incomingByIdentity.get(identity);
    incomingByIdentity.set(identity, priorIncoming ? mergeProductRecords(priorIncoming, product) : product);
  }

  let added = 0;
  let replaced = 0;
  const mergedFreePeople: PilotProduct[] = [];
  for (const [identity, product] of incomingByIdentity) {
    const prior = priorByIdentity.get(identity);
    if (prior) {
      mergedFreePeople.push(mergeProductRecords(prior, product));
      replaced += 1;
    } else {
      mergedFreePeople.push(product);
      added += 1;
    }
  }

  return {
    products: [...kept, ...mergedFreePeople],
    added,
    replaced,
    skipped,
  };
}
