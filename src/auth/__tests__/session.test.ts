import { describe, expect, it, beforeEach } from "vitest";

import { LOCAL_USERS, OWNER_USER } from "../roles";
import { getSession, resetSessionForTests, SESSION_STORAGE_KEY, setSessionUserId } from "../session";

describe("local session", () => {
  beforeEach(() => {
    resetSessionForTests();
  });

  it("defaults to Owner without storing credentials", () => {
    expect(getSession().user).toEqual(OWNER_USER);
    expect(SESSION_STORAGE_KEY.includes("password")).toBe(false);
    expect(SESSION_STORAGE_KEY.includes("secret")).toBe(false);
    expect(SESSION_STORAGE_KEY.includes("token")).toBe(false);
  });

  it("switches among local roles only", () => {
    for (const user of LOCAL_USERS) {
      expect(setSessionUserId(user.id).user.role).toBe(user.role);
    }
    expect(setSessionUserId("unknown-user").user).toEqual(OWNER_USER);
  });
});
