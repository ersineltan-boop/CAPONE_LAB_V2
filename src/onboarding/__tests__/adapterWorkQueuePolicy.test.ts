import { describe, expect, it } from "vitest";

import { buildAdapterWorkQueue } from "../adapterWorkQueue";
import { createInitialQueue, selectQueueCandidates } from "../queue";

describe("adapter work queue policy", () => {
  it("does not retry CUSTOM_ADAPTER_REQUIRED brands in the normal onboarding queue", () => {
    const now = new Date("2026-09-14T01:30:00.000Z");
    const queue = createInitialQueue({}, now);
    const nakedWolfe = queue.entries.find((entry) => entry.slug === "naked-wolfe");
    expect(nakedWolfe).toBeDefined();
    nakedWolfe!.status = "CUSTOM_ADAPTER_REQUIRED";
    nakedWolfe!.nextRetryAt = null;
    nakedWolfe!.blocker = "custom storefront adapter required";

    const selected = selectQueueCandidates(queue, { now, limit: 20 });
    expect(selected.some((entry) => entry.slug === "naked-wolfe")).toBe(false);
    expect(selected.length).toBeGreaterThan(0);

    expect(buildAdapterWorkQueue(queue)).toEqual([
      expect.objectContaining({
        brand: "NAKED WOLFE",
        slug: "naked-wolfe",
        priority: 0,
        blocker: "custom storefront adapter required",
      }),
    ]);
  });

  it("keeps Massimo Dutti and luxury adapter work at the front", () => {
    const queue = createInitialQueue();
    for (const slug of ["massimo-dutti", "mango", "aquazzura", "gianvito-rossi"]) {
      queue.entries.find((entry) => entry.slug === slug)!.status = "CUSTOM_ADAPTER_REQUIRED";
    }
    expect(buildAdapterWorkQueue(queue).map((entry) => entry.slug)).toEqual([
      "massimo-dutti", "mango", "aquazzura", "gianvito-rossi",
    ]);
  });
});
