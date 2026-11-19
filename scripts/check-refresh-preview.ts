import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { chromium, devices } from "playwright";
import type { VisualShard } from "../src/visual/types";

assert(process.argv[2] && process.argv[3], "Pass the isolated refresh directory and Vite build directory");
const run = resolve(process.argv[2]);
const site = resolve(process.argv[3]);
const visual = JSON.parse(await readFile(join(run, "frontend/visual/tumu.json"), "utf8")) as VisualShard;
const model = visual.cards.find(card => card.brand.toUpperCase() === "ALOHAS" && card.images.length > 1 &&
  (card.variants?.length ?? 0) <= 1 &&
  visual.cards.filter(other => other.productName === card.productName).length === 1);
assert(model, "Expected a uniquely named ALOHAS model with a gallery");
let catalogBytes = 0, catalogRequests = 0;
const server = createServer(async (req, res) => {
  const path = req.url?.split("?")[0] ?? "/";
  const storePath = /^\/pilot-store\/(manifest\.json|objects\/[a-f0-9]{64}\.json)$/.exec(path)?.[1];
  const sitePath = path === "/" ? "index.html" : /^\/(assets\/[\w.-]+|site\.webmanifest|icons\/[\w.-]+)$/.exec(path)?.[1];
  if (!storePath && !sitePath) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(storePath ? join(run, "store", storePath) : join(site, sitePath!));
    if (storePath) { catalogBytes += body.length; catalogRequests++; }
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
  await page.route("**/*", route => route.request().url().startsWith(`${origin}/`) ? route.continue() :
    route.request().resourceType() === "image" ? route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>' }) : route.abort());
  await page.goto(origin);
  const before = { bytes: catalogBytes, requests: catalogRequests };
  const start = performance.now();
  await page.getByRole("combobox", { name: "Sayfa seç" }).selectOption("visual-wall");
  await page.getByText(/Kaynakta yeni olanlar önce/).waitFor({ timeout: 60_000 });
  const report = { viewport: page.viewportSize(), visualMilliseconds: Math.round(performance.now() - start),
    visualCatalogBytes: catalogBytes - before.bytes, visualCatalogRequests: catalogRequests - before.requests,
    modelId: model.modelFamilyId };
  assert(report.visualCatalogBytes > 0 && report.visualCatalogRequests > 0);
  await page.getByPlaceholder("Marka veya model ara").fill(model.productName);
  await page.getByRole("heading", { name: model.productName, exact: true }).click();
  const detail = page.getByRole("dialog", { name: "Ürün Detayı" });
  await detail.getByRole("heading", { name: model.productName, exact: true }).waitFor();
  const image = detail.getByRole("img", { name: model.productName, exact: true }).first();
  const first = await image.getAttribute("src");
  assert(first);
  await detail.getByRole("button", { name: "Sonraki fotoğraf" }).click();
  await page.waitForFunction(({ name, first }) => [...document.querySelectorAll('[role="dialog"] img')]
    .some(element => element.getAttribute("alt") === name && element.getAttribute("src") !== first), { name: model.productName, first });
  await writeFile(join(run, "mobile-preview.json"), JSON.stringify({ ...report, galleryNavigationPassed: true }, null, 2));
  console.log(report, "Gallery navigation passed");
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise<void>(done => server.close(() => done()));
}
