import { describe, expect, it, beforeEach } from "vitest";

import { LOCAL_CLIENT_RECORDS } from "../ownedRecords";
import {
  canSeeAllUserRecords,
  canSeeMarketResearch,
  canViewOwnedRecord,
  filterVisibleRecords,
  isOwner,
  marketResearchListForRole,
  primaryNavItemsForRole,
  resolveViewForRole,
} from "../permissions";
import { LOCAL_USERS, type AppUser, type UserRole } from "../roles";
import { resetSessionForTests } from "../session";

const userByRole = (role: UserRole): AppUser => {
  const user = LOCAL_USERS.find((entry) => entry.role === role);
  if (!user) throw new Error(`Missing local user for ${role}`);
  return user;
};

describe("role permission matrix", () => {
  beforeEach(() => {
    resetSessionForTests();
  });

  it.each<UserRole>(["Owner", "Partner", "Employee"])(
    "%s can see Pazar Araştırması",
    (role) => {
      expect(canSeeMarketResearch(role)).toBe(true);
      expect(primaryNavItemsForRole(role).some((item) => item.id === "market-research")).toBe(
        true,
      );
      expect(resolveViewForRole("market-research", role)).toBe("market-research");
      expect(marketResearchListForRole(role, [{ id: "romania" }])).toEqual([{ id: "romania" }]);
    },
  );

  it("Producer cannot see Pazar Araştırması in nav, routes, or data", () => {
    expect(canSeeMarketResearch("Producer")).toBe(false);
    expect(isOwner("Producer")).toBe(false);
    expect(canSeeAllUserRecords("Producer")).toBe(false);
    expect(primaryNavItemsForRole("Producer").map((item) => item.id)).not.toContain(
      "market-research",
    );
    expect(primaryNavItemsForRole("Producer").map((item) => item.label)).not.toContain(
      "PAZAR ARAŞTIRMASI",
    );
    expect(resolveViewForRole("market-research", "Producer")).toBe("brands");
    expect(resolveViewForRole("saved", "Producer")).toBe("saved");
    expect(marketResearchListForRole("Producer", [{ id: "romania" }])).toEqual([]);
  });

  it("Owner sees every user's records", () => {
    const owner = userByRole("Owner");
    expect(isOwner(owner.role)).toBe(true);
    expect(canSeeAllUserRecords(owner.role)).toBe(true);
    const visible = filterVisibleRecords(LOCAL_CLIENT_RECORDS, owner);
    expect(visible.map((record) => record.id)).toEqual(LOCAL_CLIENT_RECORDS.map((record) => record.id));
    expect(visible.some((record) => record.ownerUserId === "user-partner")).toBe(true);
    expect(visible.some((record) => record.ownerUserId === "user-employee")).toBe(true);
  });

  it("Partner sees only their own records", () => {
    const partner = userByRole("Partner");
    expect(canSeeAllUserRecords(partner.role)).toBe(false);
    const visible = filterVisibleRecords(LOCAL_CLIENT_RECORDS, partner);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe("demo-partner-record");
    expect(visible[0]?.ownerUserId).toBe(partner.id);
    expect(canViewOwnedRecord(partner, "user-employee")).toBe(false);
  });

  it("Employee sees only their own records", () => {
    const employee = userByRole("Employee");
    expect(canSeeAllUserRecords(employee.role)).toBe(false);
    const visible = filterVisibleRecords(LOCAL_CLIENT_RECORDS, employee);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe("demo-employee-record");
    expect(visible[0]?.ownerUserId).toBe(employee.id);
  });

  it("Producer is not Owner and sees only their own records", () => {
    const producer = userByRole("Producer");
    expect(isOwner(producer.role)).toBe(false);
    const visible = filterVisibleRecords(LOCAL_CLIENT_RECORDS, producer);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe("demo-producer-record");
    expect(canViewOwnedRecord(producer, "user-owner")).toBe(false);
  });
});
