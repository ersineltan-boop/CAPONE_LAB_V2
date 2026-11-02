import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prepareBataProducts } from "./bata";
import type { CollectionAttemptResult } from "./collectWithFallback";

/** Current scheduled source collection, bounded and resumable; never republishes an old successful epoch. */
export async function collectBata(): Promise<CollectionAttemptResult> {
  try {
    execFileSync("python3", ["scripts/stage-bata.py", "--complete"], { cwd: process.cwd(), timeout: 2_200_000, maxBuffer: 2_000_000 });
    const root = resolve(process.cwd(), "data/brands/bata-staging");
    const progress = JSON.parse(readFileSync(resolve(root, "progress.json"), "utf8"));
    const snapshot = JSON.parse(readFileSync(resolve(root, "catalog.json"), "utf8"));
    if (progress.status !== "SOURCE_VERIFIED" || progress.checkedAt !== snapshot.checkedAt) throw new Error("Current BATA source run incomplete");
    const products = prepareBataProducts(snapshot);
    return { products, discoveredLinks: new Set(products.map(p => p.productUrl)), errors: [], method: "custom-adapter",
      rawProductUrlsDiscovered: snapshot.sourceTotal, sourceReportedProductCount: products.length,
      paginationExhausted: true, duplicateCount: 0, collectionsCrawled: ["/pt/woman/brand/bata/"] };
  } catch (error) {
    return { products: [], discoveredLinks: new Set(), errors: [String(error)], method: "custom-adapter", paginationExhausted: false };
  }
}
