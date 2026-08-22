import { describe, expect, it } from "vitest";

import {
  browsableMarketplaces,
  getMarketplaceById,
  selectActiveMarketplaceEntries,
} from "../../registry/data/marketplaces";

describe("marketplace registry pilot", () => {
  it("Mytheresa is marketplace not brand", () => {
    expect(getMarketplaceById("mytheresa")?.kind).toBe("LUXURY_MARKETPLACE");
  });

  it("only one active marketplace pilot is exposed", () => {
    const blocked = selectActiveMarketplaceEntries({
      activePilotId: "ssense",
      mytheresaStatus: "BLOCKED",
    });
    expect(blocked.filter((entry) => entry.isActive)).toHaveLength(1);
    expect(blocked.filter((entry) => entry.isActive)[0]?.id).toBe("ssense");
  });

  it("hides blocked Mytheresa from customer-facing marketplace browsing", () => {
    const entries = selectActiveMarketplaceEntries({
      activePilotId: "level-shoes",
      mytheresaStatus: "NEEDS_BROWSER_OR_ADAPTER",
    });
    expect(browsableMarketplaces(entries).map((entry) => entry.id)).toEqual(["level-shoes"]);
  });
});
