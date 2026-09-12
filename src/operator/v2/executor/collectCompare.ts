import type { CollectSafetySnapshots } from "./types";

function sourceOf(item: unknown): string {
  if (typeof item !== "object" || item === null) return "";
  if (!("source" in item)) return "";
  return String((item as { source?: unknown }).source ?? "").trim().toLowerCase();
}

export function countFreePeopleProducts(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return items.filter((item) => sourceOf(item) === "free-people").length;
}

export function snapshotsFromCatalogAndStaging(
  catalog: unknown,
  staging: unknown,
): CollectSafetySnapshots {
  const existingCount = countFreePeopleProducts(catalog);
  const incomingCount = Array.isArray(staging) ? staging.length : 0;
  return {
    existing: {
      label: "free-people-production",
      productCount: existingCount,
      valid: existingCount > 0,
    },
    incoming: {
      label: "free-people-staging",
      productCount: incomingCount,
      valid: incomingCount > 0,
    },
  };
}
