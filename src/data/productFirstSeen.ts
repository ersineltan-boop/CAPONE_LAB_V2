import type { SnapshotProduct } from "../history/types";

const snapshotProductFiles = import.meta.glob("../../data/history/*/products.json", {
  eager: true,
}) as Record<string, { default: SnapshotProduct[] }>;

export function buildProductFirstSeenIndex(): Map<string, string> {
  const index = new Map<string, string>();

  for (const file of Object.values(snapshotProductFiles)) {
    for (const product of file.default ?? []) {
      const existing = index.get(product.productUrl);
      if (!existing || Date.parse(product.firstSeen) < Date.parse(existing)) {
        index.set(product.productUrl, product.firstSeen);
      }
    }
  }

  return index;
}
