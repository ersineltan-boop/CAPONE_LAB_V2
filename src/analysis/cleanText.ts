export function cleanHeelHeight(raw: string | null): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();

  const patterns = [
    /^(\d+(?:\.\d+)?\s*(?:cm|mm|in|inches|"))/i,
    /^(\d+(?:\.\d+)?\s*In)\b/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1].trim();
  }

  const embedded = trimmed.match(
    /(?:heel(?:\s*height)?|sole height|height)[:\s]+(\d+(?:\.\d+)?\s*(?:cm|mm|in|inches|"))/i,
  );
  if (embedded) return embedded[1].trim();

  return null;
}

export function extractColorFromName(productName: string): string | null {
  const dashParts = productName.split(/\s-\s/);
  if (dashParts.length < 2) return null;

  const segment = dashParts[dashParts.length - 1].trim();
  if (!segment || segment.length > 60) return null;

  return segment;
}

export function combineText(parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => Boolean(p))
    .join(" ")
    .toLowerCase();
}
