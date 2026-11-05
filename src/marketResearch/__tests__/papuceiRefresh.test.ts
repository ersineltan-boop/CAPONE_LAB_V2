import { describe, expect, it } from "vitest";
import { createPapuceiLegacyBaselinePlan, createPapuceiRefreshPlan } from "../romania/refresh/papuceiRefresh";
import type { RomaniaCollectedProduct, RomaniaSourceStagingResult } from "../romania/collectors/types";

const at = "2026-09-17T08:00:00.000Z";
function product(index: number, images = [`https://img/${index}.jpg`]): RomaniaCollectedProduct {
  return { source_product_id: `sku-${index}`, model_key: `model-${index}`, name: `Shoe ${index}`, color: "Black", category_id: "babet", product_url: `https://papucei/${index}`, images, current_price: 100, list_price: 120, currency: "EUR", observed_at: at };
}
function staging(count: number, overrides: Partial<RomaniaSourceStagingResult> = {}): RomaniaSourceStagingResult {
  const products = Array.from({ length: count }, (_, index) => product(index));
  return { version: 1, kind: "romania-source-staging", source: { id: "papucei", name: "Papucei", sales_market: "RO", entity_kind: "brand", category_url: "https://papucei" }, coverage: { source_id: "papucei", source_name: "Papucei", status: "ok", source_total: count, collected: count, unique_models: count, missing: 0, coverage_percent: 100, gallery_coverage_percent: 100, price_coverage_percent: 100, source_unavailable: false, pagination_complete: true, last_attempt_at: at, last_success_at: at, note: null }, products, failed_product_urls: [], publishable: true, ...overrides };
}

describe("Papucei common refresh adapter", () => {
  it("rejects a false first-page 20/20 baseline", () => {
    const plan = createPapuceiRefreshPlan(staging(20));
    expect(plan.status).toBe("VALIDATION_FAILED");
    expect(plan.publishAllowed).toBe(false);
    expect(plan.health).toMatchObject({ source_total: 50, collected: 20, coverage_percent: 40 });
  });

  it("rejects a 60 to 20 parser regression and preserves last-good", () => {
    const baseline = createPapuceiLegacyBaselinePlan(staging(60)).proposedLastGood!;
    const plan = createPapuceiRefreshPlan(staging(20), baseline);
    expect(plan.status).toBe("VALIDATION_FAILED");
    expect(plan.proposedLastGood).toBeNull();
    expect(plan.health.last_good_snapshot_id).toBe(baseline.snapshot.snapshotId);
    expect(plan.validationErrors.some((error) => error.includes("catalog drop"))).toBe(true);
  });

  it("keeps previous PR17 gallery images when a later page exposes fewer images", () => {
    const first = staging(50);
    first.products[0] = product(0, ["https://img/old-a.jpg", "https://img/old-b.jpg"]);
    const baseline = createPapuceiLegacyBaselinePlan(first).proposedLastGood!;
    const next = staging(50);
    next.products[0] = product(0, ["https://img/new.jpg"]);
    const plan = createPapuceiRefreshPlan(next, baseline);
    expect(plan.status).toBe("SUCCESS");
    expect(plan.proposedLastGood?.snapshot.items[0]?.payload?.images).toEqual([
      "https://img/new.jpg", "https://img/old-a.jpg", "https://img/old-b.jpg",
    ]);
  });

  it("turns a validated legacy snapshot into a safe BASELINE", () => {
    const plan = createPapuceiLegacyBaselinePlan(staging(60));
    expect(plan.status).toBe("SUCCESS");
    expect(new Set(plan.events.map((event) => event.type))).toEqual(new Set(["BASELINE"]));
  });
});
