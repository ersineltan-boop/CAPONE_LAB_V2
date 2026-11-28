import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { chromium, devices } from "playwright";
import type { VisualCard, VisualSearchIndex, VisualShard } from "../src/visual/types";
import { VISUAL_PAGE_SIZE } from "../src/visual/visualPages";
import { BRAND_PRICE_SEGMENTS } from "../src/brands/brandPriceSegments";
import { VISUAL_BASIC_CATEGORIES } from "../src/visual/basicCategories";

const site = resolve(process.argv[2] ?? "dist");
const readVisual = async <T,>(name: string) => JSON.parse(await readFile(join(site, "data/catalog/visual", `${name}.json`), "utf8")) as T;
const index = await readVisual<VisualSearchIndex>("tumu-index");
const nameCounts = new Map<string, number>();
for (const [, name] of index.rows) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
let model: VisualCard | undefined, modelPosition = -1;
for (let i = VISUAL_PAGE_SIZE * 2; i < index.rows.length; i++) {
  const [brand, name, segment] = index.rows[i]!;
  if (brand !== "alohas" || !segment || nameCounts.get(name) !== 1) continue;
  const page = await readVisual<VisualShard>(`tumu-${Math.floor(i / VISUAL_PAGE_SIZE)}`);
  const card = page.cards[i % VISUAL_PAGE_SIZE]!;
  if (card.images.length < 2 || (card.variants?.length ?? 0) > 1) continue;
  model = card;
  modelPosition = i;
  break;
}
assert(model, "Expected a uniquely named ALOHAS model with a gallery");
let catalogBytes = 0, catalogRequests = 0;
const server = createServer(async (req, res) => {
  const path = req.url?.split("?")[0] ?? "/";
  const catalogPath = /^\/data\/catalog\/(?:[a-z0-9-]+\/)?[a-z0-9-]+\.json$/.test(path);
  const sitePath = path === "/" ? "index.html" : catalogPath ? path.slice(1) : /^\/(assets\/[\w.-]+|site\.webmanifest|icons\/[\w.-]+)$/.exec(path)?.[1];
  if (!sitePath) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(join(site, sitePath));
    if (catalogPath) { catalogBytes += body.length; catalogRequests++; }
    const types: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json" };
    res.writeHead(200, { "Content-Type": types[extname(path === "/" ? "index.html" : path)] ?? "application/octet-stream" }).end(body);
  } catch { res.writeHead(500).end(); }
});
await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
const address = server.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  browser = await chromium.launch({ executablePath: process.env.CATALOG_PILOT_CHROMIUM, args: ["--no-sandbox"] });
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  await page.route("**/*", route => route.request().url().startsWith(`${origin}/`) ? route.continue() :
    route.request().resourceType() === "image" ? route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>' }) : route.abort());
  await page.goto(origin);
  await page.getByRole("combobox", { name: "Sayfa seç" }).waitFor();
  const before = { bytes: catalogBytes, requests: catalogRequests };
  const start = performance.now();
  await page.getByRole("combobox", { name: "Sayfa seç" }).selectOption("visual-wall");
  await page.getByText(/Kaynakta yeni olanlar önce/).waitFor({ timeout: 60_000 });
  const report = { viewport: page.viewportSize(), visualMilliseconds: Math.round(performance.now() - start),
    visualCatalogBytes: catalogBytes - before.bytes, visualCatalogRequests: catalogRequests - before.requests,
    modelId: model.modelFamilyId };
  assert(report.visualCatalogBytes > 0 && report.visualCatalogBytes < 125_000 && report.visualCatalogRequests <= 3, JSON.stringify(report));
  assert.equal(await page.locator("main h3").count(), VISUAL_PAGE_SIZE);
  await page.getByRole("button", { name: /^daha fazla/i }).click();
  await page.waitForFunction(count => document.querySelectorAll("main h3").length === count, VISUAL_PAGE_SIZE * 2);
  assert.equal(await page.getByRole("heading", { name: model.productName, exact: true }).count(), 0);
  await page.getByPlaceholder("Marka veya model ara").fill(model.productName);
  const match = page.getByRole("heading", { name: model.productName, exact: true });
  await match.waitFor();
  const priceSegment = BRAND_PRICE_SEGMENTS.find(entry => entry.id === index.rows[modelPosition]![2]);
  assert(priceSegment);
  await page.getByRole("button", { name: priceSegment.label, exact: true }).click();
  const category = VISUAL_BASIC_CATEGORIES.find(entry => entry.id === model.basicCategory);
  assert(category);
  await page.getByRole("button", { name: new RegExp(`^${category.label} \\d+$`) }).click();
  await match.click();
  const detail = page.getByRole("dialog", { name: "Ürün Detayı" });
  await detail.getByRole("heading", { name: model.productName, exact: true }).waitFor();
  const image = detail.getByRole("img", { name: model.productName, exact: true }).first();
  const first = await image.getAttribute("src");
  assert(first);
  await detail.getByRole("button", { name: "Sonraki fotoğraf" }).click();
  await page.waitForFunction(({ name, first }) => [...document.querySelectorAll('[role="dialog"] img')]
    .some(element => element.getAttribute("alt") === name && element.getAttribute("src") !== first), { name: model.productName, first });
  const note = detail.locator("textarea");
  await note.fill("Mobile smoke test");
  await detail.getByRole("button", { name: "Kaydet ♡", exact: true }).click();
  await detail.getByRole("button", { name: "Kaydedildi ♥", exact: true }).waitFor();
  await page.reload();
  await page.getByRole("combobox", { name: "Sayfa seç" }).selectOption("saved");
  await page.getByRole("heading", { name: model.productName, exact: true }).click();
  await detail.getByRole("heading", { name: model.productName, exact: true }).waitFor();
  assert.equal(await note.inputValue(), "Mobile smoke test");
  await detail.getByRole("button", { name: "Kaydedildi ♥", exact: true }).click();
  const result = { ...report, galleryNavigationPassed: true, savedModelAndNoteAfterReload: true };
  if (process.argv[3]) await writeFile(resolve(process.argv[3]), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise<void>(done => server.close(() => done()));
}
