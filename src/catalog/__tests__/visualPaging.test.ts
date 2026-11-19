import { afterEach, describe, expect, it, vi } from "vitest";
import { loadVisualResults, setCatalogFetch, setCatalogSnapshotBase } from "../catalogClient";
import type { VisualCard, VisualSearchRow } from "../../visual/types";

const cards: VisualCard[] = Array.from({ length: 5 }, (_, position) => ({
  modelFamilyId: `model-${position}`, productName: position === 4 ? "Distant Ballet Flat" : `Boot ${position}`,
  brand: position === 4 ? "ALOHAS" : "Other", mainImage: null, images: [], sourceId: "brand",
  sourceUrl: null, basicCategory: "babet", verifiedNew: position === 4,
}));
const rows = cards.map(card => [card.brand.toLowerCase(), card.productName.toLowerCase(),
  card.verifiedNew ? "PREMIUM" : "LUXURY", card.verifiedNew ? 1 : 0] satisfies VisualSearchRow);
const defaultFilters = { query: "", segment: "all", onlyNew: false } as const;

afterEach(() => {
  setCatalogSnapshotBase("");
  setCatalogFetch((input, init) => fetch(input, init));
});

function fixtures(pageSize?: number) {
  const objects: Record<string, unknown> = {
    "visual-summary.json": { categories: [{ id: "tumu", count: 5 }], pageSize },
    "visual/tumu.json": { id: "tumu", cards },
    "visual/tumu-index.json": { id: "tumu", rows },
    ...Object.fromEntries([0, 1, 2].map(number => [`visual/tumu-${number}.json`, { id: "tumu", cards: cards.slice(number * 2, number * 2 + 2) }])),
  };
  const request = vi.fn(async (url: string) => Response.json(objects[url.replace("/data/catalog/", "")]));
  setCatalogFetch(request);
  return () => request.mock.calls.map(([url]) => url.replace("/data/catalog/", ""));
}

describe("Visual delivery", () => {
  it("fetches only the visible page, then reuses it when loading more", async () => {
    const paths = fixtures(2);
    expect(await loadVisualResults("tumu", defaultFilters, 2)).toEqual({ cards: cards.slice(0, 2), total: 5 });
    expect(paths()).toEqual(["visual-summary.json", "visual/tumu-0.json"]);
    expect((await loadVisualResults("tumu", defaultFilters, 4)).cards).toEqual(cards.slice(0, 4));
    expect(paths()).toEqual(["visual-summary.json", "visual/tumu-0.json", "visual/tumu-1.json"]);
  });

  it("combines search and filters across unseen pages without downloading unrelated cards", async () => {
    const paths = fixtures(2);
    expect(await loadVisualResults("tumu", { query: " ALOHAS ", onlyNew: true, segment: "PREMIUM" }, 2))
      .toEqual({ cards: [cards[4]], total: 1 });
    expect(await loadVisualResults("tumu", { query: "alohas", onlyNew: true, segment: "LUXURY" }, 2))
      .toEqual({ cards: [], total: 0 });
    expect(paths()).toEqual(["visual-summary.json", "visual/tumu-index.json", "visual/tumu-2.json"]);
  });

  it("can read a previously published full catalog during rollout", async () => {
    const paths = fixtures();
    expect(await loadVisualResults("tumu", { ...defaultFilters, query: "distant" }, 2))
      .toEqual({ cards: [cards[4]], total: 1 });
    expect(paths()).toEqual(["visual-summary.json", "visual/tumu.json"]);
  });
});
