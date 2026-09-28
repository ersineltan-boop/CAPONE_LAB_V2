/** NODE_USE_ENV_PROXY=1 node --import tsx scripts/collect-massimo-staging.ts */
import { mkdir, writeFile } from "node:fs/promises";
import { collectMassimoDuttiCatalog } from "../src/onboarding/massimoDutti";
import type { OnboardingHttp } from "../src/onboarding/http";
const http: OnboardingHttp = { async fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  return { ok: response.ok, status: response.status, url: response.url, text: await response.text() };
} };
const result = await collectMassimoDuttiCatalog(http);
if (!result.products.length) throw new Error(`No validated products; existing staging preserved: ${result.errors.join("; ")}`);
await mkdir("data/onboarding/validated", { recursive: true });
const output = { generatedAt: new Date().toISOString(), source: "massimo-dutti", status: "PARTIAL", ...result, discoveredLinks: [...result.discoveredLinks] };
await writeFile("data/onboarding/validated/massimo-dutti.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ products: result.products.length, gridCount: result.sourceReportedProductCount, status: "PARTIAL", errors: result.errors }));
