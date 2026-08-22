import type { SourceNativeCategory } from "./types";
import { slugifyCategoryId } from "./sourceCategories";

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url.trim().replace(/\/$/, "").toLowerCase();
  }
}

function normalizePath(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.trim().replace(/\/$/, "").toLowerCase();
}

/**
 * Conservative display dedupe only when identity/URL proves equivalence.
 * Does not merge "Boots" with "Ankle Boots".
 */
export function dedupeDisplayCategories(
  categories: SourceNativeCategory[],
): SourceNativeCategory[] {
  const result: SourceNativeCategory[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenPaths = new Set<string>();

  for (const category of categories) {
    const id = category.categoryId || slugifyCategoryId(category.categoryName);
    const url = normalizeUrl(category.categoryUrl ?? null);
    const path = normalizePath(category.categoryPath ?? null);

    if (seenIds.has(id)) continue;
    if (url && seenUrls.has(url)) continue;
    if (path && seenPaths.has(path)) continue;

    seenIds.add(id);
    if (url) seenUrls.add(url);
    if (path) seenPaths.add(path);
    result.push(category);
  }

  return result;
}
