import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { open, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { analyzeProducts } from "../../analysis/analyzeProduct";
import { mergeCatalogPreservingFailedSources } from "../../collector/mergeProducts";
import { createLegacyProductCatalogStore } from "../../collector/sourceProductArchive";
import type { PilotProduct } from "../../collector/types";
import { hydrateRefreshArchive, refreshArchivePath, refreshCatalogDigests, stageRefreshArchive } from "../refreshArchiveHandoff";
import { REFRESH_MAX_FILE_BYTES } from "../refreshStaging";

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

it("runs two unpublished refreshes and starts the second from the first archive", async () => {
  const directory = await mkdtemp(join(tmpdir(), "capone-refresh-rounds-"));
  const root = join(directory, "checkout");
  const round2 = join(directory, "round2");
  const round3 = join(directory, "round3");
  const git = (cwd: string, args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" });
  const originalA = catalogProduct("brand-a", "Brand A", "model-a", [
    "https://cdn.example/a-1.jpg",
    "https://cdn.example/a-2.jpg",
  ]);
  const originalB = catalogProduct("brand-b", "Brand B", "model-b", ["https://cdn.example/b-0.jpg"]);
  try {
    await mkdir(root);
    git(root, ["init", "-q"]);
    const legacy = createLegacyProductCatalogStore(join(root, "data/multibrand"));
    await legacy.write("products", [originalA, originalB]);
    await legacy.write("analyzed-products", analyzeProducts([originalA, originalB]));
    git(root, ["add", "--", "data/multibrand/products.json", "data/multibrand/analyzed-products.json"]);
    commit(root);
    expect(await hydrateRefreshArchive(root)).toEqual({ source: "legacy baseline" });

    await applyFailedSourceRefresh(root, "https://cdn.example/b-1.jpg");
    const firstReports = await stageRefreshArchive(root);
    expect(firstReports.map((report) => report.kind)).toEqual(["products", "analyzed-products"]);
    expect(Math.max(...firstReports.map((report) => report.maxPartBytes))).toBeLessThan(REFRESH_MAX_FILE_BYTES);
    expect(stagedPaths(root)).not.toContain("data/multibrand/products.json");
    expect(stagedPaths(root)).not.toContain("data/multibrand/analyzed-products.json");
    expect(stagedPaths(root)).toContain(`${refreshArchivePath}/products/manifest.json`);
    expect(stagedPaths(root)).toContain(`${refreshArchivePath}/analyzed-products/manifest.json`);
    commit(root);
    expect(git(root, ["remote"]).trim()).toBe("");

    await checkoutVerified(root, round2);
    const stale = await readFile(join(round2, "data/multibrand/products.json"), "utf8");
    expect(stale).not.toContain("b-1.jpg");
    expect(await hydrateRefreshArchive(round2)).toMatchObject({ source: "archive", products: 2, analyzed: 2 });
    const started = await createLegacyProductCatalogStore(join(round2, "data/multibrand")).read<PilotProduct>("products");
    expect(galleryOf(started, "brand-a")).toEqual(galleryOf([originalA], "brand-a"));
    expect(JSON.stringify(started)).toContain("b-1.jpg");
    expect(JSON.stringify(started)).not.toContain("WIPED");

    await applyFailedSourceRefresh(round2, "https://cdn.example/b-2.jpg");
    const refreshed = await createLegacyProductCatalogStore(join(round2, "data/multibrand")).read<PilotProduct>("products");
    const analyzed = await createLegacyProductCatalogStore(join(round2, "data/multibrand")).read<PilotProduct>("analyzed-products");
    expect(galleryOf(refreshed, "brand-a")).toEqual(galleryOf([originalA], "brand-a"));
    expect(galleryOf(analyzed, "brand-a")).toEqual(galleryOf([originalA], "brand-a"));
    expect(JSON.stringify(refreshed)).toContain("b-1.jpg");
    expect(JSON.stringify(refreshed)).toContain("b-2.jpg");
    await stageRefreshArchive(round2);
    expect(stagedPaths(round2)).not.toContain("data/multibrand/products.json");
    expect(stagedPaths(round2)).not.toContain("data/multibrand/analyzed-products.json");
    commit(round2);
    expect(git(round2, ["remote"]).trim()).toBe("");

    await checkoutVerified(round2, round3);
    const staleMonolith = await readFile(join(round3, "data/multibrand/products.json"), "utf8");
    expect(staleMonolith).not.toContain("b-1.jpg");
    expect(staleMonolith).not.toContain("b-2.jpg");
    expect(await hydrateRefreshArchive(round3)).toMatchObject({ source: "archive", products: 2, analyzed: 2 });
    const finalProducts = await createLegacyProductCatalogStore(join(round3, "data/multibrand")).read<PilotProduct>("products");
    const finalAnalyzed = await createLegacyProductCatalogStore(join(round3, "data/multibrand")).read<PilotProduct>("analyzed-products");
    expect(galleryOf(finalProducts, "brand-a")).toEqual(galleryOf([originalA], "brand-a"));
    expect(galleryOf(finalAnalyzed, "brand-a")).toEqual(galleryOf([originalA], "brand-a"));
    expect(JSON.stringify(finalProducts)).toContain("b-1.jpg");
    expect(JSON.stringify(finalProducts)).toContain("b-2.jpg");
    expect(JSON.stringify(finalAnalyzed)).toContain("a-1.jpg");
    expect(JSON.stringify(finalAnalyzed)).toContain("b-2.jpg");
    expect(git(round3, ["remote"]).trim()).toBe("");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);

it("stops when an archive part is missing or corrupt and does not fall back to the old monolith", async () => {
  const directory = await mkdtemp(join(tmpdir(), "capone-refresh-broken-"));
  const root = join(directory, "checkout");
  const missing = join(directory, "missing");
  const corrupt = join(directory, "corrupt");
  const git = (cwd: string, args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" });
  try {
    await mkdir(root);
    git(root, ["init", "-q"]);
    const legacy = createLegacyProductCatalogStore(join(root, "data/multibrand"));
    await legacy.write("products", [{ source: "brand-a", marker: "stale-monolith" }]);
    await legacy.write("analyzed-products", [{ source: "brand-a", marker: "stale-monolith" }]);
    git(root, ["add", "--", "data/multibrand/products.json", "data/multibrand/analyzed-products.json"]);
    commit(root);
    await legacy.write("products", [{ source: "brand-a", marker: "verified-archive" }]);
    await legacy.write("analyzed-products", [{ source: "brand-a", marker: "verified-archive" }]);
    await stageRefreshArchive(root);
    commit(root);

    await checkoutVerified(root, missing);
    const stale = await readFile(join(missing, "data/multibrand/products.json"), "utf8");
    expect(stale).toContain("stale-monolith");
    const manifest = JSON.parse(await readFile(join(missing, refreshArchivePath, "analyzed-products/manifest.json"), "utf8")) as {
      parts: Array<{ file: string }>;
    };
    const [missingSource, missingFile] = manifest.parts[0]!.file.split("/");
    await rm(join(missing, refreshArchivePath, "analyzed-products", missingSource!, missingFile!));
    await expect(hydrateRefreshArchive(missing)).rejects.toThrow();
    expect(await readFile(join(missing, "data/multibrand/products.json"), "utf8")).toBe(stale);
    expect(await readFile(join(missing, "data/multibrand/analyzed-products.json"), "utf8")).toContain("stale-monolith");

    await checkoutVerified(root, corrupt);
    const corruptStale = await readFile(join(corrupt, "data/multibrand/products.json"), "utf8");
    const productsManifest = JSON.parse(await readFile(join(corrupt, refreshArchivePath, "products/manifest.json"), "utf8")) as {
      parts: Array<{ file: string }>;
    };
    const [corruptSource, corruptFile] = productsManifest.parts[0]!.file.split("/");
    const partPath = join(corrupt, refreshArchivePath, "products", corruptSource!, corruptFile!);
    const body = await readFile(partPath, "utf8");
    await writeFile(partPath, body.replace("verified-archive", "tampered-archive"));
    await expect(hydrateRefreshArchive(corrupt)).rejects.toThrow("Source archive integrity failure");
    expect(await readFile(join(corrupt, "data/multibrand/products.json"), "utf8")).toBe(corruptStale);
    expect(corruptStale).not.toContain("verified-archive");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects a 90 MiB delivery file and keeps the previous verified archive", async () => {
  expect(REFRESH_MAX_FILE_BYTES).toBe(90 * 1024 * 1024);
  const directory = await mkdtemp(join(tmpdir(), "capone-refresh-limit-"));
  const root = join(directory, "checkout");
  const git = (cwd: string, args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" });
  try {
    await mkdir(root);
    git(root, ["init", "-q"]);
    const legacy = createLegacyProductCatalogStore(join(root, "data/multibrand"));
    await legacy.write("products", [{ source: "brand-a" }]);
    await legacy.write("analyzed-products", [{ source: "brand-a" }]);
    git(root, ["add", "--", "data/multibrand/products.json", "data/multibrand/analyzed-products.json"]);
    commit(root);
    await stageRefreshArchive(root);
    commit(root);
    const manifestPath = join(root, refreshArchivePath, "products/manifest.json");
    const verified = await readFile(manifestPath, "utf8");
    await legacy.write("products", [{ source: "brand-a" }, { source: "brand-b" }]);
    const oversized = await open(join(root, "data/multibrand/collection-report.json"), "w");
    await oversized.truncate(REFRESH_MAX_FILE_BYTES);
    await oversized.close();
    await expect(stageRefreshArchive(root)).rejects.toThrow(
      "Oversized delivery: data/multibrand/collection-report.json",
    );
    expect(await readFile(manifestPath, "utf8")).toBe(verified);
    expect(git(root, ["diff", "--cached", "--name-only"]).trim()).toBe("");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);

function gitExec(cwd: string, args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function commit(cwd: string) {
  gitExec(cwd, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "-qm", "verified"]);
}

function stagedPaths(cwd: string) {
  return gitExec(cwd, ["diff", "--cached", "--name-only"]).trim().split("\n");
}

async function checkoutVerified(source: string, target: string) {
  await mkdir(target);
  gitExec(target, ["init", "-q"]);
  gitExec(source, ["checkout-index", "--all", `--prefix=${target.replaceAll("\\", "/")}/`]);
  gitExec(target, ["add", "-A"]);
  commit(target);
}

function catalogProduct(source: string, brand: string, model: string, images: string[]): PilotProduct {
  return {
    source,
    brand,
    productName: model,
    productUrl: `https://${source}.example/${model}`,
    sourceModelCode: model,
    imageUrl: images[0] ?? null,
    images,
    category: "PUMP",
    color: null,
    material: null,
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: null,
    discoveredAt: "2026-11-01T00:00:00.000Z",
    variants: [{ title: model, color: null, sku: `${model}-37`, imageUrl: images[0] ?? null, images }],
  };
}

function galleryOf(rows: readonly PilotProduct[], source: string) {
  return rows.filter((row) => row.source === source).map((row) => ({
    model: row.sourceModelCode,
    images: row.images,
    imageUrl: row.imageUrl,
    variantImages: row.variants.map((variant) => variant.images),
  }));
}

async function applyFailedSourceRefresh(root: string, nextImage: string) {
  const legacy = createLegacyProductCatalogStore(join(root, "data/multibrand"));
  const existing = await legacy.read<PilotProduct>("products");
  const currentB = existing.find((row) => row.source === "brand-b");
  if (!currentB?.sourceModelCode) throw new Error("Expected an archived Brand B model");
  const wiped = catalogProduct("brand-a", "Brand A", "WIPED", []);
  const updated = catalogProduct("brand-b", "Brand B", currentB.sourceModelCode, [nextImage]);
  const products = mergeCatalogPreservingFailedSources(existing, [wiped, updated], new Set(["Brand A"]));
  await legacy.write("products", products);
  await legacy.write("analyzed-products", analyzeProducts(products));
}
