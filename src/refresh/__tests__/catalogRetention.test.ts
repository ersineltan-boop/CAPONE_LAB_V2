import { describe, expect, it } from "vitest";

import { retainedModelCountBlocker } from "../catalogRetention";

describe("scheduled catalog last-good retention", () => {
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
