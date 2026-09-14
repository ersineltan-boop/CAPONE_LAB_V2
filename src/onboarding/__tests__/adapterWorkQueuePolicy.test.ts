import { describe, expect, it } from "vitest";

import { createInitialQueue, selectQueueCandidates } from "../queue";

describe("adapter work queue policy", () => {
  it("does not retry CUSTOM_ADAPTER_REQUIRED brands in the normal onboarding queue", () => {
    const now = new Date("2026-09-14T01:30:00.000Z");
    const queue = createInitialQueue({}, now);
    const nakedWolfe = queue.entries.find((entry) => entry.slug === "naked-wolfe");
    expect(nakedWolfe).toBeDefined();
    nakedWolfe!.status = "CUSTOM_ADAPTER_REQUIRED";
    nakedWolfe!.nextRetryAt = null;

    const selected = selectQueueCandidates(queue, { now, limit: 20 });
    expect(selected.some((entry) => entry.slug === "naked-wolfe")).toBe(false);
    expect(selected.length).toBeGreaterThan(0);
  });
});
