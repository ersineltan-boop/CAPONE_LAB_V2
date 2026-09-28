import { defaultOnboardingHttp, type OnboardingHttp } from './http';
import { parseSitemapLocs } from './sitemap';
import { parseLuxuryStructuredPage } from './luxuryStructured';
import type { PilotProduct } from '../collector/types';

export const luxurySources = {
  'maison-margiela': { brand: 'MAISON MARGIELA', origin: 'https://www.maisonmargiela.com', sitemap: '/en-us/sitemap_index.xml' },
  'ala-a': { brand: 'ALAÏA', origin: 'https://www.maison-alaia.com', sitemap: '/en-us/sitemap_index.xml' },
} as const;
export type LuxurySource = keyof typeof luxurySources;
export async function collectLuxuryStaging(source: LuxurySource, options: {
  http?: OnboardingHttp; limit?: number; concurrency?: number; full?: boolean;
} = {}) {
  const config = luxurySources[source];
  const http = options.http ?? defaultOnboardingHttp;
  const discoveredAt = new Date().toISOString();
  const errors: string[] = [];
  const candidates = new Set<string>();
  const visited = new Set<string>();
  const pending: string[] = [config.origin + config.sitemap];
  const safe = (url: string) => {
    try { const u = new URL(url); return u.origin === config.origin && u.pathname.startsWith('/en-us/') && !u.search; } catch { return false; }
  };
  while (pending.length && visited.size < 16) {
    const url = pending.shift()!;
    if (visited.has(url) || !safe(url)) continue;
    visited.add(url);
    const page = await http.fetchText(url, { timeoutMs: 20000 });
    if (!page.ok) { errors.push(`Sitemap ${page.status}: ${url}`); continue; }
    const locs = parseSitemapLocs(page.text);
    if (!locs.length) errors.push(`Empty or unreadable sitemap: ${url}`);
    for (const loc of locs) {
      if (!safe(loc)) continue;
      if (/\.xml$/i.test(loc)) { if (!visited.has(loc)) pending.push(loc); }
      else if (/\.html$/i.test(loc) && /shoe|ballet|sandal|boot|sneaker|mule|pump|loafer|slipper|derb|heel|ballerin|tabi/i.test(new URL(loc).pathname)) candidates.add(loc);
    }
  }
  const urls = [...candidates];
  const selected = options.full ? urls : urls.slice(0, Math.max(1, Math.floor(options.limit ?? 40)));
  const products: PilotProduct[] = [];
  let cursor = 0, successfulPages = 0, excludedOrUnparsedPages = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(4, Math.floor(options.concurrency ?? 4))) }, async () => {
    while (cursor < selected.length) {
      const url = selected[cursor++];
      try {
        const page = await http.fetchText(url, { timeoutMs: 20000 });
        if (!page.ok) { errors.push(`Product ${page.status}: ${url}`); continue; }
        if (!safe(page.url)) { errors.push(`Off-source or locale redirect: ${page.url}`); continue; }
        successfulPages++;
        const parsed = parseLuxuryStructuredPage(page.text, { source, brand: config.brand, productUrl: url, discoveredAt });
        if (!parsed.length) excludedOrUnparsedPages++;
        products.push(...parsed);
      } catch (error) { errors.push(`${url}: ${String(error)}`); }
    }
  }));
  const unique = [...new Map(products.map(p => [p.productUrl, p])).values()].sort((a,b) => a.productUrl.localeCompare(b.productUrl));
  return { source, brand: config.brand, collectedAt: discoveredAt, products: unique,
    coverage: { status: unique.length ? 'PARTIAL' : 'FAILED', activated: false,
      sourceReportedWomensFootwearTotal: null, discoveredCandidateUrls: urls.length,
      attemptedPages: selected.length, successfulPages, excludedOrUnparsedPages,
      acceptedFemaleFootwearProducts: unique.length, bounded: selected.length < urls.length,
      sitemapTraversalExhausted: !pending.length, sitemapsVisited: [...visited],
      note: 'Staging only. Candidate URL discovery is heuristic; source womens footwear total is unknown. Exclusions include male/unknown audience and unparsed schema. Full mode exhausts discovered candidates, not a completeness guarantee.', errors } };
}
