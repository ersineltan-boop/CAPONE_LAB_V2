import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { loadBrandShard, loadCatalogSummary, loadMarketplaceShard, loadVisualShard, resetCatalogCache, setCatalogFetch, setCatalogSnapshotBase } from "../src/catalog/catalogClient";

const run = resolve(process.argv[2] ?? ".");
const site = resolve("logs/catalog-pilot/site");
if (!run.startsWith(`${resolve("logs/catalog-pilot")}/`)) throw new Error("Pass a pilot run directory");
const report = JSON.parse(await readFile(join(run, "report.json"), "utf8"));
const baseline = await readFile(join(run, "baseline-manifest.json"));
const updated = await readFile(join(run, "store/manifest.json"));
let current = baseline;
const html = await readFile(join(site, "index.html"));
const asset = html.toString().match(/src="(\/assets\/[^" ]+\.js)"/)?.[1];
assert(asset);
const assets = () => readFile(join(site, asset));
const initialAsset = createHash("sha256").update(await assets()).digest("hex");
const responses = new Map<string, number>();
const server = createServer(async (req, res) => {
  const path = req.url?.split("?")[0] ?? "/";
  try {
    let body: Buffer, mime = "application/json";
    if (path === "/pilot-store/manifest.json") body = current;
    else if (/^\/pilot-store\/objects\/[0-9a-f]{64}\.json$/.test(path)) body = await readFile(join(run, "store", path.slice("/pilot-store/".length)));
    else if (/^\/assets\/[a-zA-Z0-9_.-]+\.(?:css|js)$/.test(path)) {
      body = await readFile(join(site, path));
      mime = path.endsWith(".js") ? "application/javascript" : "text/css";
    } else if (path === "/") { body = html; mime = "text/html"; }
    else { res.writeHead(404).end(); return; }
    responses.set(path, (responses.get(path) ?? 0) + 1);
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" }).end(body);
  } catch { res.writeHead(500).end(); }
});
await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
const address = server.address();
assert(address && typeof address !== "string");
const url = `http://127.0.0.1:${address.port}`;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  if (process.argv.includes("--http-only")) {
    setCatalogSnapshotBase("/pilot-store");
    setCatalogFetch((path, init) => fetch(new URL(path, url), init));
    const before = await loadCatalogSummary();
    assert.equal(before.brands.length, 83);
    const alohas = await loadBrandShard("alohas");
    assert.equal(alohas.families.find(f => f.modelFamilyId === report.replay.id)?.canonicalName, report.replay.originalName);
    current = updated;
    // An open session retains a consistent snapshot even if a publish occurs.
    assert.deepEqual(await loadBrandShard("alohas"), alohas);
    resetCatalogCache();
    const updatedBrand = await loadBrandShard("alohas");
    const name = `${report.replay.originalName} [pilot replay]`;
    assert.equal(updatedBrand.families.find(f => f.modelFamilyId === report.replay.id)?.canonicalName, name);
    const visual = await loadVisualShard("tumu");
    assert.equal(visual.cards.find(card => card.modelFamilyId === report.replay.id)?.productName, name);
    const marketplace = await loadMarketplaceShard("farfetch");
    assert.equal(marketplace.families.length, before.marketplaces.find(m => m.sourceId === "farfetch")?.productCount);
    assert.equal(createHash("sha256").update(await assets()).digest("hex"), initialAsset);
    console.log("HTTP confirmed: existing session stays consistent; a new session reads updated brand and reassembles Visual and Farfetch without an app rebuild.");
  } else {
  browser = await chromium.launch({ executablePath: process.env.CATALOG_PILOT_CHROMIUM, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  // Avoid external image/font requests: this is a delivery and browser rendering test.
  await page.route("**/*", route => route.request().url().startsWith(url + "/") ? route.continue() : route.abort());
  const open = async () => {
    await page.goto(url);
    await page.getByRole("button", { name: /ALOHAS/ }).first().click();
  };
  await open();
  const search = page.getByPlaceholder("Marka veya model ara");
  await search.fill(report.replay.originalName);
  await page.getByRole("heading", { name: report.replay.originalName, exact: true }).first().waitFor();
  current = updated;
  await page.goto("about:blank");
  await open();
  await search.fill("[pilot replay]");
  await page.getByRole("heading", { name: `${report.replay.originalName} [pilot replay]`, exact: true }).first().waitFor();
  await page.getByRole("button", { name: "VISUAL", exact: true }).click();
  await page.getByPlaceholder("Marka veya model ara").fill("[pilot replay]");
  await page.getByText(`${report.replay.originalName} [pilot replay]`, { exact: true }).first().waitFor();
  assert.equal(createHash("sha256").update(await assets()).digest("hex"), initialAsset);
  assert([...responses.keys()].filter(path => path.startsWith("/pilot-store/objects/")).length > 3);
  console.log("Browser confirmed: identical app bundle rendered new ALOHAS and reassembled Visual data after manifest-only update.");
  }
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise<void>(done => server.close(() => done()));
}
