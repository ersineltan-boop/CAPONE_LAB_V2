/** NODE_USE_ENV_PROXY=1 node --import tsx scripts/collect-massimo-staging.ts */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { collectMassimoDuttiCatalog } from "../src/onboarding/massimoDutti";
import { mergeProductCatalog } from "../src/collector/mergeProducts";
import type { OnboardingHttp } from "../src/onboarding/http";
const http: OnboardingHttp = { async fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  return { ok: response.ok, status: response.status, url: response.url, text: await response.text() };
} };
const result = await collectMassimoDuttiCatalog(http);
if (!result.products.length) throw new Error(`No validated products; existing staging preserved: ${result.errors.join("; ")}`);
await mkdir("data/onboarding/validated", { recursive: true });
let prior = [];
try { prior = JSON.parse(await readFile("data/onboarding/validated/massimo-dutti.json", "utf8")).products ?? []; }
catch (error: any) { if (error.code !== "ENOENT") throw error; }
const products = mergeProductCatalog(prior, result.products);
const output = { generatedAt: new Date().toISOString(), source: "massimo-dutti", status: "PARTIAL", ...result, products, collectedThisRun: result.products.length, discoveredLinks: [...result.discoveredLinks] };
await writeFile("data/onboarding/validated/massimo-dutti.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ products: result.products.length, gridCount: result.sourceReportedProductCount, status: "PARTIAL", errors: result.errors }));
