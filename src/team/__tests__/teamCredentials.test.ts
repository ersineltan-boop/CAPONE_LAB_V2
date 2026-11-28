import { describe, expect, it } from "vitest";
import {
  isNewTeamPassword,
  normalizeTeamUsername,
  teamLoginAddress,
} from "../../../supabase/functions/_shared/teamCredentials";

describe("CAPONE account credentials", () => {
  it("maps different spellings of the same username to a single private login alias", () => {
    const username = normalizeTeamUsername("  Sample_User-2  ");
    expect(username).toBe("sample_user-2");
    expect(teamLoginAddress(username!)).toBe("sample_user-2@accounts.capone.invalid");
  });

  it.each(["a", "12test", "name@example.com", "two names", "şapka", "n".repeat(33)])(
    "rejects a username outside the permitted format (%s)",
    (value) => expect(normalizeTeamUsername(value)).toBeNull(),
  );

  it("enforces the same password length and byte limit in both environments", () => {
    expect(isNewTeamPassword("a".repeat(11))).toBe(false);
    expect(isNewTeamPassword("a".repeat(12))).toBe(true);
    expect(isNewTeamPassword("ü".repeat(36))).toBe(true);
    expect(isNewTeamPassword("ü".repeat(37))).toBe(false);
  });
});
