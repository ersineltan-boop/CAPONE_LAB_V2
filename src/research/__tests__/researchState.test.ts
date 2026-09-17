import { describe, expect, it, beforeEach } from "vitest";

import { resetSessionForTests } from "../../auth/session";
import {
  getResearchStateRepository,
  isReviewed,
  isSaved,
  resetResearchStateRepositoryForTests,
} from "../researchStateRepository";

describe("research state repository", () => {
  beforeEach(() => {
    resetSessionForTests();
    resetResearchStateRepositoryForTests();
  });

  it("persists reviewed state", () => {
    const repo = getResearchStateRepository();
    repo.setReviewed("family-a", true);
    expect(isReviewed(repo.get("family-a"))).toBe(true);
  });

  it("persists saved state", () => {
    const repo = getResearchStateRepository();
    repo.setSaved("family-a", true);
    expect(isSaved(repo.get("family-a"))).toBe(true);
  });

  it("persists note", () => {
    const repo = getResearchStateRepository();
    repo.setNote("family-a", "Test notu");
    expect(repo.get("family-a").note).toBe("Test notu");
  });

  it("model rebuild does not affect research state keys", () => {
    const repo = getResearchStateRepository();
    repo.setReviewed("family-a", true);
    repo.setSaved("family-a", true);
    const all = repo.getAll();
    expect(all.has("family-a")).toBe(true);
    expect(all.get("family-a")?.reviewedAt).toBeTruthy();
  });
});
