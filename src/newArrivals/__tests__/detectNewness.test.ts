import { describe, expect, it } from "vitest";

import { buildNewnessFromProductHints, detectNewBadgeInText } from "../detectNewness";
import { isVerifiedNew } from "../newness";

describe("buildNewnessFromProductHints", () => {
  it("accepts standalone source labels and rejects names or marketing prose", () => {
    for (const label of ["NEW", "New In", "new-arrivals", "just_in"]) expect(detectNewBadgeInText(label)).toBe(true);
    for (const text of ["NEW YORK Mule", "New Balance Sneaker", "New Chocolate Slide", "brand new sole", "renewed"]) expect(detectNewBadgeInText(text)).toBe(false);
  });
  it("does not mark backfill publishedAt alone as VERIFIED_NEW", () => {
    const newness = buildNewnessFromProductHints(
      {
        publishedAt: "2023-08-02T14:06:48-04:00",
        createdAt: "2023-08-02T14:06:48-04:00",
        productUrl: "https://example.com/p",
      },
      "2026-08-19T00:00:00.000Z",
    );
    expect(isVerifiedNew(newness)).toBe(false);
  });

  it("uses explicit date with new-arrivals collection context", () => {
    const newness = buildNewnessFromProductHints(
      {
        isNewArrivalsCollection: true,
        collectionPath: "/collections/new-arrivals",
        publishedAt: "2026-08-01T00:00:00.000Z",
        productUrl: "https://example.com/p",
      },
      "2026-08-21T00:00:00.000Z",
    );
    expect(newness.evidenceType).toBe("NEW_ARRIVALS_COLLECTION");
    expect(newness.effectiveNewAt).toBe("2026-08-01T00:00:00.000Z");
  });
});
