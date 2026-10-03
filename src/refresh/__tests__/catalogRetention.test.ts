import { describe, expect, it } from "vitest";

import type { PilotProduct } from "../../collector/types";
import { preserveSourceBeforeFailedMembership, retainedModelCountBlocker } from "../catalogRetention";

describe("scheduled catalog last-good retention", () => {
  it("restores pre-run NEW evidence and galleries on failed membership without rolling back other sources", () => {
    const old = { source: "brand", productUrl: "https://brand.test/products/old", isNewArrivalsCollection: true, images: ["https://cdn.test/old.jpg"] } as PilotProduct;
    const other = { source: "other", productUrl: "https://other.test/products/fresh" } as PilotProduct;
    const fresh = { ...old, isNewArrivalsCollection: false, images: ["https://cdn.test/fresh.jpg"] };
    expect(preserveSourceBeforeFailedMembership([fresh, other], [old], "brand")).toEqual([other, old]);
  });
  it("keeps a substantial source loss out of the delivery", () => {
    expect(retainedModelCountBlocker(100, 59, "browns")).toContain("last-good");
    expect(retainedModelCountBlocker(100, 0, "browns")).toContain("last-good");
  });

  it("allows normal changes and new sources", () => {
    expect(retainedModelCountBlocker(100, 60, "browns")).toBeNull();
    expect(retainedModelCountBlocker(100, 120, "browns")).toBeNull();
    expect(retainedModelCountBlocker(0, 20, "new-brand")).toBeNull();
  });

  it("rejects invalid counts", () => {
    expect(retainedModelCountBlocker(100, Number.NaN, "brand")).toContain("invalid");
  });
});
