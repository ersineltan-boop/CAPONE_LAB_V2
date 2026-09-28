/** Read-only public-source diagnosis. No cookies, proxy rotation, or challenge bypass.
 * Run: NODE_USE_ENV_PROXY=1 node scripts/probe-massimo-source.ts (Node 24+)
 */
import { mkdir, writeFile } from "node:fs/promises";

const base = "https://www.massimodutti.com";
const paths = ["/", "/robots.txt", "/sitemap.xml", "/us/en/categories?ajax=true", "/3/info/sitemaps/sitemap-index-home-categories-md.xml", "/3/info/sitemaps/sitemap-index-products-md.xml", "/us/women/shoes-n1499", "/itxrest/2/catalog/store/34009527/30359506/category/1887045/product"];
const attempts = [];
for (const path of paths) {
  const url = `${base}${path}`;
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const body = await response.text();
    attempts.push({
      url, startedAt, status: response.status, finalUrl: response.url,
      contentType: response.headers.get("content-type"),
      bytes: Buffer.byteLength(body),
      accessDenied: /access denied|you don't have permission/i.test(body),
      edgeDenialEvidence: /errors(?:&#46;|\.)edgesuite(?:&#46;|\.)net/i.test(body),
      title: body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null,
      jsonResponse: (() => { try { JSON.parse(body); return true; } catch { return false; } })(),
    });
  } catch (error) {
    attempts.push({ url, startedAt, status: null, error: error instanceof Error ? error.message : String(error) });
  }
}
const shoesAccessible = attempts.some((attempt) => attempt.url.endsWith("/us/women/shoes-n1499") && attempt.status === 200);
const denied = attempts.some((attempt) => attempt.status === 403 || attempt.accessDenied);
const report = {
  sourceId: "massimo-dutti",
  investigatedAt: new Date().toISOString(),
  status: shoesAccessible ? "OFFICIAL_SSR_ACCESSIBLE_PARTIAL_ADAPTER" : denied ? "OFFICIAL_SOURCE_ACCESS_BLOCKED" : "REQUIRES_RESPONSE_REVIEW",
  attempts,
  collectedProductCount: null,
  stagingArtifact: "data/onboarding/validated/massimo-dutti.json",
  adapterFinding: "Zara-compatible categories?ajax=true returns 404. Massimo uses its own Angular mdfrontw-state SSR transfer data. Source-specific adapter src/onboarding/massimoDutti.ts maps official women footwear records; SSR provides only a bounded initial subset.",
  action: "Stage validated official SSR products as PARTIAL; do not replace last-good data or claim complete coverage.",
  nextDependency: "Discover and validate the current public pagination mechanism or expand verified footwear subcategories. The old itxrest/2 catalog route exposed in page configuration returns 410 OBSOLETE_FEATURE; do not wire it as a working collector.",
  scope: "Bounded diagnostics of public official URLs, without attempting to bypass access controls. Access denial is specific to this execution environment; it does not prove the website is unavailable to shoppers.",
};
await mkdir("data/registry", { recursive: true });
await writeFile("data/registry/massimo-source-investigation.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
