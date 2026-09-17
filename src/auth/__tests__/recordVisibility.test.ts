import { describe, expect, it, beforeEach } from "vitest";

import { LOCAL_USERS } from "../roles";
import { resetSessionForTests, setSessionUserId } from "../session";
import { filterVisibleRecords } from "../permissions";
import {
  getBrandFavoriteRepository,
  resetBrandFavoriteRepositoryForTests,
} from "../../research/brandFavoritesRepository";
import {
  getResearchStateRepository,
  resetResearchStateRepositoryForTests,
} from "../../research/researchStateRepository";

describe("client record lists honor role visibility", () => {
  beforeEach(() => {
    resetSessionForTests();
    resetResearchStateRepositoryForTests();
    resetBrandFavoriteRepositoryForTests();
  });

  it("Owner sees Partner and Employee saved product records", () => {
    setSessionUserId("user-partner");
    getResearchStateRepository().setSaved("family-partner", true);
    setSessionUserId("user-employee");
    getResearchStateRepository().setSaved("family-employee", true);

    setSessionUserId("user-owner");
    const visible = getResearchStateRepository().listVisible();
    expect([...visible.keys()].sort()).toEqual(["family-employee", "family-partner"]);

    setSessionUserId("user-partner");
    expect([...getResearchStateRepository().listVisible().keys()]).toEqual(["family-partner"]);

    setSessionUserId("user-employee");
    expect([...getResearchStateRepository().listVisible().keys()]).toEqual(["family-employee"]);
  });

  it("Owner sees other users' saved brands; Partner and Employee do not", () => {
    setSessionUserId("user-partner");
    getBrandFavoriteRepository().setSaved("jeffrey-campbell", true);
    setSessionUserId("user-employee");
    getBrandFavoriteRepository().setSaved("the-row", true);

    setSessionUserId("user-owner");
    expect(
      getBrandFavoriteRepository()
        .listVisible()
        .map((item) => item.brandId)
        .sort(),
    ).toEqual(["jeffrey-campbell", "the-row"]);

    setSessionUserId("user-partner");
    expect(getBrandFavoriteRepository().listVisible().map((item) => item.brandId)).toEqual([
      "jeffrey-campbell",
    ]);
    expect(getBrandFavoriteRepository().isSaved("the-row")).toBe(false);

    setSessionUserId("user-employee");
    expect(getBrandFavoriteRepository().listVisible().map((item) => item.brandId)).toEqual([
      "the-row",
    ]);
  });

  it("Producer cannot read another user's records even when they exist", () => {
    setSessionUserId("user-owner");
    getResearchStateRepository().setSaved("family-owner", true);

    setSessionUserId("user-producer");
    const visible = getResearchStateRepository().listVisible();
    expect(visible.has("family-owner")).toBe(false);
    expect(
      filterVisibleRecords(
        getResearchStateRepository().listAllRecords(),
        LOCAL_USERS.find((user) => user.role === "Producer")!,
      ).some((record) => record.ownerUserId === "user-owner"),
    ).toBe(false);
  });
});
