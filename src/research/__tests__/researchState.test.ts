import { describe, expect, it, beforeEach } from "vitest";

import {
  getResearchStateRepository,
  isReviewed,
  isSaved,
  resetResearchStateRepositoryForTests,
} from "../researchStateRepository";

describe("research state repository", () => {
  beforeEach(() => {
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

  it("saves a product and its note with one repository update", () => {
    const repo = getResearchStateRepository();
    const observed: Array<ReturnType<typeof repo.get>> = [];
    const unsubscribe = repo.subscribe(() => observed.push(repo.get("family-a")));
    repo.setSaved("family-a", true, "  İnce bantla numune yap  ");
    unsubscribe();
    expect(observed).toHaveLength(1);
    expect(observed[0]?.savedAt).toBeTruthy();
    expect(observed[0]?.note).toBe("İnce bantla numune yap");
  });

  it("preserves an existing note on an unsave or a blank save", () => {
    const repo = getResearchStateRepository();
    repo.setSaved("family-a", true, "Mevcut not");
    expect(repo.setSaved("family-a", false, "Kullanılmayacak").note).toBe("Mevcut not");
    expect(repo.setSaved("family-a", true, " ").note).toBe("Mevcut not");
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
