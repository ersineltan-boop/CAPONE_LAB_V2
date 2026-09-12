const REJECTED_IMAGE_HINTS =
  /\b(logo|badge|favicon|icon|sprite|banner|promo|campaign|hamburger|sticky|label_|wysiwyg|placeholder)\b/i;

export function isUsableMarketResearchImage(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  } catch {
    return false;
  }
  return !REJECTED_IMAGE_HINTS.test(trimmed);
}

export function usableMarketResearchImages(urls: readonly string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const url of urls) {
    if (!isUsableMarketResearchImage(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    kept.push(url);
  }
  return kept;
}
