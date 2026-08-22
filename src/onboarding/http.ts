import { fetchText, sleep } from "../collector/http";

export interface OnboardingHttpResult {
  ok: boolean;
  status: number;
  text: string;
  url: string;
  error?: string;
}

export interface OnboardingHttp {
  fetchText(
    url: string,
    options?: { delayMs?: number; headers?: Record<string, string> },
  ): Promise<OnboardingHttpResult>;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const defaultOnboardingHttp: OnboardingHttp = {
  async fetchText(url, options) {
    if (options?.delayMs) await sleep(options.delayMs);
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
          ...options?.headers,
        },
        redirect: "follow",
        keepalive: false,
        signal: AbortSignal.timeout(20000),
      });
      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        text,
        url: response.url,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        status: 0,
        text: "",
        url,
        error: message,
      };
    }
  },
};

export { fetchText };

export async function fetchMaybeJson(
  http: OnboardingHttp,
  url: string,
  delayMs = 400,
  headers?: Record<string, string>,
): Promise<{ ok: boolean; status: number; json: unknown | null; text: string; url: string }> {
  const result = await http.fetchText(url, { delayMs, headers });
  if (!result.ok) {
    return { ok: false, status: result.status, json: null, text: result.text, url: result.url };
  }
  const trimmed = result.text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return { ok: result.ok, status: result.status, json: null, text: result.text, url: result.url };
  }
  try {
    return {
      ok: true,
      status: result.status,
      json: JSON.parse(trimmed),
      text: result.text,
      url: result.url,
    };
  } catch {
    return { ok: true, status: result.status, json: null, text: result.text, url: result.url };
  }
}
