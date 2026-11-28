import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("BOBBIES Linux worker parser regression suite", () => {
  it.skipIf(process.platform === "win32")("runs the offline Python own gallery, product identity and pagination tests in CI", () => {
    expect(() => execFileSync("python3", ["scripts/test-stage-bobbies.py"], {
      cwd: process.cwd(), timeout: 10_000, encoding: "utf8",
    })).not.toThrow();
  });
});
