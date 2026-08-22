import type { OnboardingPlatform } from "./types";

export interface PlatformFingerprint {
  platform: OnboardingPlatform;
  signals: string[];
}

export function fingerprintStorefront(input: {
  html?: string;
  url?: string;
  jsonHint?: unknown;
}): PlatformFingerprint {
  const html = input.html ?? "";
  const url = (input.url ?? "").toLowerCase();
  const signals: string[] = [];

  const shopify =
    /cdn\.shopify\.com/i.test(html) ||
    /Shopify\.theme/i.test(html) ||
    /myshopify\.com/i.test(html) ||
    /\/products\.json/i.test(html);
  if (shopify) signals.push("shopify");

  const inditex =
    /itxrest/i.test(html) ||
    /categories\?ajax=true/i.test(html) ||
    /static\.zara\.net|static\.massimodutti\.com|static\.bershka\.net|static\.pullandbear\.net/i.test(
      html,
    ) ||
    (typeof input.jsonHint === "object" &&
      input.jsonHint !== null &&
      "categories" in input.jsonHint);
  if (inditex) signals.push("inditex");

  const salesforce =
    /demandware/i.test(html) ||
    /\/on\/demandware/i.test(html) ||
    /Salesforce Commerce/i.test(html) ||
    /dwanalytics/i.test(html);
  if (salesforce) signals.push("salesforce");

  const nextjs = /__NEXT_DATA__/i.test(html) || /\/_next\//i.test(html);
  if (nextjs) signals.push("nextjs");

  const structured =
    /application\/ld\+json/i.test(html) || /"@type"\s*:\s*"Product"/i.test(html);
  if (structured) signals.push("jsonld");

  const sitemap = /sitemap/i.test(url) || /<urlset/i.test(html);
  if (sitemap) signals.push("sitemap");

  if (signals.includes("shopify")) {
    return { platform: "SHOPIFY", signals };
  }
  if (signals.includes("inditex")) {
    return { platform: "INDITEX-LIKE PUBLIC CATALOG", signals };
  }
  if (signals.includes("salesforce")) {
    return { platform: "SALESFORCE COMMERCE", signals };
  }
  if (signals.includes("nextjs")) {
    return { platform: "NEXT.JS PUBLIC DATA", signals };
  }
  if (signals.includes("jsonld")) {
    return { platform: "STRUCTURED-DATA CATALOG", signals };
  }
  if (signals.includes("sitemap")) {
    return { platform: "SITEMAP PRODUCT CRAWL", signals };
  }
  return { platform: "UNKNOWN", signals };
}

export function looksLikeBotChallenge(html: string, status: number): boolean {
  if (status === 403 || status === 401 || status === 429) return true;
  return /captcha|access denied|attention required|cf-challenge|akamai/i.test(html);
}
