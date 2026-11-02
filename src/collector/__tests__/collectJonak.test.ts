import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { collectJonak } from "../collectJonak";

describe("guarded registry JONAK collector", () => {
  beforeEach(() => vi.resetAllMocks());
  it("never publishes a cached successful snapshot after the new collection fails", async () => {
    vi.mocked(execFileSync).mockImplementation(() => { throw new Error("source access blocked"); });
    const result = await collectJonak();
    expect(result.products).toEqual([]);
    expect(result.paginationExhausted).toBe(false);
    expect(readFileSync).not.toHaveBeenCalled();
  });
  it("requires progress and snapshot to belong to the same successful run", async () => {
    vi.mocked(readFileSync).mockReturnValueOnce(JSON.stringify({ checkedAt: "old" })).mockReturnValueOnce(JSON.stringify({ status: "PARTIAL", checkedAt: "new" }));
    const result = await collectJonak();
    expect(result.products).toEqual([]);
    expect(result.errors.join(" ")).toContain("incomplete");
    expect(execFileSync).toHaveBeenCalledWith("python3", ["scripts/stage-jonak.py"], expect.objectContaining({ timeout: 190_000 }));
  });
});
