/** NODE_USE_ENV_PROXY=1 node --import tsx scripts/collect-massimo-staging.ts */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { collectMassimoDuttiCatalog } from "../src/onboarding/massimoDutti";
import { mergeProductCatalog } from "../src/collector/mergeProducts";
import { defaultOnboardingHttp } from "../src/onboarding/http";
const result = await collectMassimoDuttiCatalog(defaultOnboardingHttp);
if (!result.products.length) throw new Error(`No validated products; existing staging preserved: ${result.errors.join("; ")}`);
await mkdir("data/onboarding/validated", { recursive: true });
let prior = [];
try { prior = JSON.parse(await readFile("data/onboarding/validated/massimo-dutti.json", "utf8")).products ?? []; }
catch (error: any) { if (error.code !== "ENOENT") throw error; }
const products = mergeProductCatalog(prior, result.products);
const status = result.paginationExhausted && result.errors.length === 0 ? "FULL" : "PARTIAL";
const output = { generatedAt: new Date().toISOString(), source: "massimo-dutti", status, ...result, products, collectedThisRun: result.products.length, discoveredLinks: [...result.discoveredLinks] };
await writeFile("data/onboarding/validated/massimo-dutti.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ products: result.products.length, gridCount: result.sourceReportedProductCount, status, errors: result.errors }));
