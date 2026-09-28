import { describe, expect, it } from "vitest";

import { priorityRefreshBlocker } from "../prioritySourceGate";

describe("partial priority brand refresh", () => {
  const good = { previousCount: 100, currentCount: 105, freshCount: 85, errors: [], completed: true };

  it("accepts fresh, completed snapshots while retaining earlier products", () => {
    expect(priorityRefreshBlocker(good)).toBeNull();
  });

  it("rejects a blocked source or a large fresh-count drop", () => {
    expect(priorityRefreshBlocker({ ...good, errors: ["HTTP 403"] })).toContain("error");
    expect(priorityRefreshBlocker({ ...good, freshCount: 79 })).toContain("80%");
    expect(priorityRefreshBlocker({ ...good, completed: false })).toContain("did not finish");
    expect(priorityRefreshBlocker({ ...good, currentCount: 99 })).toContain("removed");
  });
});
