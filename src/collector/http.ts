const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SOURCE_REQUEST_TIMEOUT_MS = 15_000;

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchText(
  url: string,
  options?: { delayMs?: number; headers?: Record<string, string> },
): Promise<{ ok: boolean; status: number; text: string; url: string; error?: string }> {
  if (options?.delayMs) await sleep(options.delayMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        ...options?.headers,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(SOURCE_REQUEST_TIMEOUT_MS),
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
}

export async function fetchJsonPost<T>(
  url: string,
  body: unknown,
  delayMs = 800,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  if (delayMs) await sleep(delayMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      redirect: "follow",
      signal: AbortSignal.timeout(SOURCE_REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, data: null, error: `HTTP ${response.status} for ${url}` };
    }
    try {
      return { ok: true, status: response.status, data: JSON.parse(text) as T };
    } catch {
      return { ok: false, status: response.status, data: null, error: `Invalid JSON from ${url}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 0, data: null, error: message };
  }
}

export async function fetchJson<T>(
  url: string,
  delayMs = 1500,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const result = await fetchText(url, { delayMs });
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      data: null,
      error: `HTTP ${result.status} for ${url}`,
    };
  }

  try {
    return {
      ok: true,
      status: result.status,
      data: JSON.parse(result.text) as T,
    };
  } catch {
    return {
      ok: false,
      status: result.status,
      data: null,
      error: `Invalid JSON from ${url}`,
    };
  }
}
