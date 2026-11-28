import { describe, expect, it } from "vitest";

import { createInitialQueue, emptyQueueEntry } from "../queue";
import { selectQueueCandidates } from "../selection";

describe("scheduled onboarding recovery slot", () => {
  it("takes one due partial catalog while keeping priority and rotation slots", () => {
    const now = new Date("2026-11-29T03:00:00.000Z");
    const attempted = "2026-10-03T09:25:09.505Z";
    const queue = createInitialQueue({}, now);
    queue.entries = [
      ...["jimmy-choo", "christian-louboutin", "bottega-veneta", "saint-laurent"].map((slug, index) => ({
        ...emptyQueueEntry(slug, slug, index, `https://${slug}.example`),
        status: "PRIORITY_BLOCKED" as const,
        lastAttemptAt: attempted,
      })),
      emptyQueueEntry("Untried", "untried", 4, "https://untried.example"),
      { ...emptyQueueEntry("First", "first", 5, "https://first.example"), status: "PARTIAL", productsFound: 20, lastAttemptAt: attempted },
      { ...emptyQueueEntry("Strongest", "strongest", 6, "https://strongest.example"), status: "PARTIAL", productsFound: 688, lastAttemptAt: attempted },
      { ...emptyQueueEntry("Future", "future", 7, "https://future.example"), status: "PARTIAL", productsFound: 900, nextRetryAt: "2026-12-01T03:00:00.000Z" },
    ];

    expect(selectQueueCandidates(queue, { now, limit: 5, scheduled: true }).map(entry => entry.slug))
      .toEqual(["jimmy-choo", "christian-louboutin", "bottega-veneta", "strongest", "untried"]);
    expect(selectQueueCandidates(queue, { now, limit: 5 }).map(entry => entry.slug))
      .toEqual(["jimmy-choo", "christian-louboutin", "bottega-veneta", "saint-laurent", "untried"]);
  });
});
