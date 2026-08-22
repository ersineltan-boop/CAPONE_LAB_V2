import { describe, expect, it } from "vitest";

import { getResearchStateRepository } from "../researchStateRepository";

describe("shared saved product state", () => {
  it("uses one research repository instance across views", () => {
    expect(getResearchStateRepository()).toBe(getResearchStateRepository());
  });
});
