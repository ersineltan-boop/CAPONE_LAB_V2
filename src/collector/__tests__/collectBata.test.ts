import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { collectBata } from "../collectBata";

describe("BATA scheduled collector guard", () => {
  beforeEach(() => vi.resetAllMocks());
  it("retains previous source data by returning no replacement after access denial", async () => {
    vi.mocked(execFileSync).mockImplementation(() => { throw new Error("HTTP 403"); });
    const result = await collectBata();
    expect(result.products).toEqual([]);
    expect(readFileSync).not.toHaveBeenCalled();
    expect(result.paginationExhausted).toBe(false);
  });
  it("never replaces current data with an old successful snapshot after a partial run", async () => {
    vi.mocked(readFileSync).mockReturnValueOnce(JSON.stringify({ status: "PARTIAL", checkedAt: "new" })).mockReturnValueOnce(JSON.stringify({ checkedAt: "old" }));
    expect((await collectBata()).products).toEqual([]);
    expect(execFileSync).toHaveBeenCalledWith("python3", ["scripts/stage-bata.py", "--complete"], expect.objectContaining({ timeout: 2_200_000 }));
  });
});
