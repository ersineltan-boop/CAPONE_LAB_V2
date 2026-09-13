import { describe, expect, it } from "vitest";

import { createInitialQueue, mergeQueueWithDefaults, selectQueueCandidates } from "../queue";

const NAKED_WOLFE_SOURCE = "https://nakedwolfe.com/collections/view-all-womens";

describe("Naked Wolfe onboarding queue", () => {
  it("seeds Naked Wolfe from the official women's footwear collection", () => {
    const queue = createInitialQueue();
    const entry = queue.entries.find((item) => item.slug === "naked-wolfe");

    expect(entry).toMatchObject({
      brand: "NAKED WOLFE",
      priority: 0,
      status: "PENDING",
      sourceUrl: NAKED_WOLFE_SOURCE,
      attempts: 0,
      nextRetryAt: null,
    });
  });

  it("adds Naked Wolfe to an existing legacy queue without resetting prior states", () => {
    const legacy = createInitialQueue();
    legacy.entries = legacy.entries.filter((item) => item.slug !== "naked-wolfe");
    legacy.entries[0]!.status = "CUSTOM_ADAPTER_REQUIRED";
    legacy.entries[0]!.attempts = 3;

    const merged = mergeQueueWithDefaults(legacy);
    expect(merged.entries.find((item) => item.slug === "naked-wolfe")?.sourceUrl).toBe(
      NAKED_WOLFE_SOURCE,
    );
    expect(merged.entries.find((item) => item.slug === legacy.entries[0]!.slug)?.attempts).toBe(3);
  });

  it("selects Naked Wolfe while old blocked brands are waiting for retry", () => {
    const now = new Date("2026-09-13T15:00:00.000Z");
    const queue = createInitialQueue();
    for (const entry of queue.entries) {
      if (entry.slug === "naked-wolfe") continue;
      entry.status = "CUSTOM_ADAPTER_REQUIRED";
      entry.nextRetryAt = "2026-09-15T00:00:00.000Z";
    }

    const selected = selectQueueCandidates(queue, { now, limit: 5 });
    expect(selected.map((item) => item.slug)).toEqual(["naked-wolfe"]);
  });
});
