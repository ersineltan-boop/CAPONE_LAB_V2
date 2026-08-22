import { describe, expect, it } from "vitest";

import { nextVisibleCount, initialVisibleCount, DEFAULT_BATCH } from "../progressiveBatch";

describe("progressive batch", () => {
  it("grows 48 → 96 → 144 and stops at the filtered total", () => {
    expect(DEFAULT_BATCH).toBe(48);
    expect(initialVisibleCount(48, 200)).toBe(48);
    expect(nextVisibleCount(48, 48, 200)).toBe(96);
    expect(nextVisibleCount(96, 48, 200)).toBe(144);
    expect(nextVisibleCount(192, 48, 200)).toBe(200);
    expect(nextVisibleCount(40, 48, 40)).toBe(40);
  });

  it("resets to the first batch when the filtered set is smaller", () => {
    expect(initialVisibleCount(48, 20)).toBe(20);
  });
});
