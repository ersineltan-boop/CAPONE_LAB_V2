import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prepareJonakProducts } from "./jonak";
import type { CollectionAttemptResult } from "./collectWithFallback";


/** Existing registry refresh calls the same bounded collector; no cached FULL fallback. */
export async function collectJonak(): Promise<CollectionAttemptResult> {
  try {
    const root = process.cwd();
    execFileSync("python3", ["scripts/stage-jonak.py"], { cwd: root, timeout: 190_000, maxBuffer: 1_000_000 });
    const snapshot = JSON.parse(readFileSync(resolve(root, "data/brands/jonak-staging/catalog.json"), "utf8"));
    const progress = JSON.parse(readFileSync(resolve(root, "data/brands/jonak-staging/progress.json"), "utf8"));
    if (progress.status !== "LISTING_VERIFIED" || progress.checkedAt !== snapshot.checkedAt) throw new Error("JONAK current run is incomplete");
    const { products } = prepareJonakProducts(snapshot);
    return { products, discoveredLinks: new Set(products.map(p => p.productUrl)), errors: [], method: "custom-adapter",
      pagesTraversed: progress.requests, rawProductUrlsDiscovered: snapshot.sourceTotal,
      // Verified footwear scope after explicit accessory reconciliation; raw total remains above and in progress.
      sourceReportedProductCount: products.length, duplicateCount: 0, paginationExhausted: true,
      collectionsCrawled: ["/collection/woman-shoes.html"] };
  } catch (error) {
    return { products: [], discoveredLinks: new Set(), errors: [String(error)], method: "custom-adapter", paginationExhausted: false };
  }
}
