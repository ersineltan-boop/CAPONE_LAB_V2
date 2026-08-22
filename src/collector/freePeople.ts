import { fetchText } from "./http";
import type { PilotProduct } from "./types";

export const FREE_PEOPLE_ID = "free-people";
export const FREE_PEOPLE_NAME = "Free People";
export const FREE_PEOPLE_BASE = "https://www.freepeople.com";
export const FREE_PEOPLE_SHOES_URL = "https://www.freepeople.com/shoes/";

const PROBE_URLS = [
  "https://www.freepeople.com/shoes/",
  "https://www.freepeople.com/womens-shoes/",
  "https://www.freepeople.com/shoes/?format=json",
  "https://www.freepeople.com/products.json?limit=5",
];

export function isFreePeopleAntiBot(status: number, body: string): boolean {
  if (status === 403 || status === 429 || status === 503) return true;
  if (body.length < 2000 && /#cmsg|pardon our interruption|access denied|captcha|akamai/i.test(body)) {
    return true;
  }
  return false;
}

export async function collectFreePeople(): Promise<{
  products: PilotProduct[];
  errors: string[];
  blocked: boolean;
  coverageStatus: "FAILED" | "NEEDS_PROBE";
  blocker: string;
}> {
  const errors: string[] = [];
  for (const url of PROBE_URLS) {
    const result = await fetchText(url, { delayMs: 600 });
    if (isFreePeopleAntiBot(result.status, result.text)) {
      errors.push(`HTTP ${result.status} anti-bot at ${url}`);
      continue;
    }
    if (!result.ok) {
      errors.push(result.error ?? `HTTP ${result.status} at ${url}`);
    }
  }

  return {
    products: [],
    errors,
    blocked: true,
    coverageStatus: "FAILED",
    blocker:
      "freepeople.com returns Akamai/bot-manager 403 on public HTML and catalog endpoints. No stable public JSON listing was reachable without bypassing anti-bot protection.",
  };
}
