import { coverImage, dedupeUrls } from "./gallery";
import type { SalesforceColorway, SalesforceModelCard } from "./types";

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mostCommonName(colorways: readonly SalesforceColorway[]): string {
  const counts = new Map<string, number>();
  for (const colorway of colorways) {
    counts.set(colorway.productName, (counts.get(colorway.productName) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
    ?? colorways[0]?.productName
    ?? "Unknown";
}

/** One model card holds every colourway. Cover art is a product photo, never a swatch. */
export function groupColorwaysIntoModelCards(
  brandSlug: string,
  brand: string,
  colorways: readonly SalesforceColorway[],
): SalesforceModelCard[] {
  const groups = new Map<string, SalesforceColorway[]>();
  for (const colorway of colorways) {
    const key = colorway.modelCode || colorway.productId;
    const list = groups.get(key) ?? [];
    list.push(colorway);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .map(([modelCode, members]) => {
      const ordered = [...members].sort((a, b) => a.productUrl.localeCompare(b.productUrl));
      const images = dedupeUrls(ordered.flatMap((member) => member.images));
      const canonicalName = mostCommonName(ordered);
      return {
        modelFamilyId: `${brandSlug}--${slug(modelCode)}`,
        brand,
        canonicalName,
        modelCode,
        category: ordered.find((member) => member.category)?.category ?? null,
        coverImage: coverImage(images),
        images,
        colorways: ordered,
        isNew: false as const,
      };
    })
    .sort((a, b) => a.modelFamilyId.localeCompare(b.modelFamilyId));
}
