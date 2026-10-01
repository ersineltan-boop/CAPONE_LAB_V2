const SWATCH_IMAGE =
  /\/swatch(?:\/|[._-])|[_-]swatch(?:[._-]|$)|color[-_]?chip|colour[-_]?chip/i;

export function isColorSwatchImage(url: string): boolean {
  return SWATCH_IMAGE.test(url);
}

export function canonicalProductUrl(value: string, origin: string): string | null {
  try {
    const base = new URL(origin);
    const url = new URL(value, base);
    if (url.origin !== base.origin) return null;
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

export function dedupeUrls(urls: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed) || isColorSwatchImage(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function coverImage(images: readonly string[]): string | null {
  return dedupeUrls(images)[0] ?? null;
}
