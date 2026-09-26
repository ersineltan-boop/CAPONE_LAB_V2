import { fetchText } from "../collector/http";

export interface MarketplaceProbeCandidate {
  id: string;
  name: string;
  footwearUrl: string;
  productHrefPattern: RegExp;
  pageParam?: string;
  newArrivalUrl?: string;
}

export const MARKETPLACE_PROBE_CANDIDATES: MarketplaceProbeCandidate[] = [
  {
    id: "ssense",
    name: "SSENSE",
    footwearUrl: "https://www.ssense.com/en-us/women/shoes",
    productHrefPattern: /href="(\/en-us\/women\/[^"]+)"/i,
  },
  {
    id: "24s",
    name: "24S",
    footwearUrl: "https://www.24s.com/en-us/women/shoes",
    productHrefPattern: /href="([^"]*\/product\/[^"]+)"/i,
  },
  {
    id: "luisaviaroma",
    name: "LuisaViaRoma",
    footwearUrl: "https://www.luisaviaroma.com/en-us/women/shoes",
    productHrefPattern: /href="([^"]*\/p\/[^"]+)"/i,
  },
  {
    id: "farfetch",
    name: "Farfetch",
    footwearUrl: "https://www.farfetch.com/uk/shopping/women/shoes-1/items.aspx",
    productHrefPattern: /href="([^"]*\/shopping\/[^"]+\/item-[^"]+)"/i,
    pageParam: "page",
  },
  {
    id: "free-people",
    name: "Free People",
    footwearUrl: "https://www.freepeople.com/shoes/",
    productHrefPattern: /href="([^"]*\/shop\/[^"]+)"/i,
  },
  {
    id: "net-a-porter",
    name: "Net-a-Porter",
    footwearUrl: "https://www.net-a-porter.com/en-us/shop/shoes",
    productHrefPattern: /href="([^"]*\/shop\/product\/[^"]+)"/i,
  },
  {
    id: "moda-operandi",
    name: "Moda Operandi",
    footwearUrl: "https://www.modaoperandi.com/women/shoes",
    productHrefPattern: /href="([^"]*\/p\/[^"]+)"/i,
  },
  {
    id: "browns",
    name: "Browns",
    footwearUrl: "https://www.brownsfashion.com/uk/shopping/woman/shoes",
    productHrefPattern: /href="([^"]*\/shopping\/[^"]+)"/i,
  },
  {
    id: "the-webster",
    name: "The Webster",
    footwearUrl: "https://thewebster.com/collections/women-shoes",
    productHrefPattern: /href="([^"]*\/products\/[^"]+)"/i,
  },
  {
    id: "level-shoes",
    name: "Level Shoes",
    footwearUrl: "https://www.levelshoes.com/women/shoes.html",
    productHrefPattern: /href="([^"]*[a-z0-9-]+-women(?:s)?-[a-z0-9-]+\.html)"/i,
    pageParam: "p",
    newArrivalUrl: "https://www.levelshoes.com/women/shoes/new.html",
  },
];

export interface MarketplaceProbeResult {
  id: string;
  name: string;
  ok: boolean;
  status: number;
  productLinkCount: number;
  blocked: boolean;
  error?: string;
}

export function isAntiBotHtml(html: string, status: number): boolean {
  if (status === 403 || status === 429 || status === 503) return true;
  if (html.length < 8000 && /captcha|cloudflare|datadome|challenge|access denied/i.test(html)) {
    return true;
  }
  return false;
}

export function countProductLinks(html: string, pattern: RegExp): number {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const global = new RegExp(pattern.source, flags);
  const matches = html.match(global) ?? [];
  return new Set(matches).size;
}

export function selectSuccessfulPilot(
  results: MarketplaceProbeResult[],
): MarketplaceProbeResult | null {
  const successful = results.filter(
    (result) => result.ok && !result.blocked && result.productLinkCount >= 8,
  );
  successful.sort((a, b) => b.productLinkCount - a.productLinkCount);
  return successful[0] ?? null;
}

export async function probeMarketplaceCandidate(
  candidate: MarketplaceProbeCandidate,
): Promise<MarketplaceProbeResult> {
  const response = await fetchText(candidate.footwearUrl, { delayMs: 1200 });
  if (!response.ok) {
    return {
      id: candidate.id,
      name: candidate.name,
      ok: false,
      status: response.status,
      productLinkCount: 0,
      blocked: isAntiBotHtml(response.text, response.status),
      error: response.error ?? `HTTP ${response.status}`,
    };
  }
  const blocked = isAntiBotHtml(response.text, response.status);
  const productLinkCount = blocked ? 0 : countProductLinks(response.text, candidate.productHrefPattern);
  return {
    id: candidate.id,
    name: candidate.name,
    ok: !blocked && productLinkCount > 0,
    status: response.status,
    productLinkCount,
    blocked,
  };
}

export async function probeMarketplaceCandidates(
  candidates: MarketplaceProbeCandidate[] = MARKETPLACE_PROBE_CANDIDATES,
): Promise<MarketplaceProbeResult[]> {
  const results: MarketplaceProbeResult[] = [];
  for (const candidate of candidates) {
    results.push(await probeMarketplaceCandidate(candidate));
  }
  return results;
}
