import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createLegacyProductCatalogStore } from "../../collector/sourceProductArchive";
import { hydrateRefreshArchive, refreshArchivePath, refreshCatalogDigests, stageRefreshArchive } from "../refreshArchiveHandoff";

it("stages both catalog archives, restores from Git's index, and refuses a broken half", async () => {
  const directory = await mkdtemp(join(tmpdir(), "capone-refresh-handoff-"));
  const root = join(directory, "checkout"), next = join(directory, "next");
  try {
    await mkdir(root);
    await mkdir(next);
    const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
    git("init", "-q");
    const legacy = createLegacyProductCatalogStore(join(root, "data/multibrand"));
    await legacy.write("products", [{ source: "brand-a" }]);
    await legacy.write("analyzed-products", [{ source: "brand-a" }]);
    const paths = ["data/multibrand/products.json", "data/multibrand/analyzed-products.json"];
    git("add", "--", ...paths);
    git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "-qm", "baseline");
    expect(await hydrateRefreshArchive(root)).toEqual({ source: "legacy baseline" });

    const rows = [{ source: "brand-a", images: ["/first"] }, { source: "brand-b" }, { source: "brand-a", images: ["/last"] }];
    await legacy.write("products", rows);
    await legacy.write("analyzed-products", [...rows].reverse());
    const reports = await stageRefreshArchive(root);
    expect(reports.map(report => report.rows)).toEqual([3, 3]);
    const staged = git("diff", "--cached", "--name-only").trim().split("\n");
    expect(staged.every(path => path.startsWith(`${refreshArchivePath}/`))).toBe(true);
    assert(staged.includes(`${refreshArchivePath}/products/manifest.json`));
    assert(staged.includes(`${refreshArchivePath}/analyzed-products/manifest.json`));

    git("checkout-index", "--all", `--prefix=${next}/`);
    expect(await hydrateRefreshArchive(next)).toEqual({ source: "archive", products: 3, analyzed: 3 });
    const expected = await refreshCatalogDigests(root);
    expect(await refreshCatalogDigests(next)).toEqual(expected);

    await writeFile(join(next, refreshArchivePath, "analyzed-products/manifest.json"), "{}");
    await expect(hydrateRefreshArchive(next)).rejects.toThrow("Invalid source archive manifest");
    expect(await refreshCatalogDigests(next)).toEqual(expected);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
