/**
 * Shared cover/hero image ranking. Prefer packshot-like product frames
 * over lifestyle, collage, and known crop/view suffixes.
 */

const LIFESTYLE =
  /lifestyle|lookbook|editorial|campaign|on[-_]?figure|worn|street[-_]?style|collage/i;
const TIGHT_CROP = /crop_new|crop-new|cropped|detail[-_]?crop|close[-_]?up/i;
const SCENE7_CROP_VIEW = /\/(?:freepeople|FreePeople)\/[^/?#]*_b(?:[/?._]|$)/i;
const PACKSHOT_HINT =
  /packshot|still[-_]?life|ghost|product[-_]?shot|_e(?:[/?._]|$)|_a(?:[/?._]|$)|_01(?:[/?._]|$)|_1(?:[/?._]|$)/i;

export function scoreCoverImageUrl(url: string): number {
  const value = url.trim();
  if (!value) return -100;
  let score = 10;
  if (LIFESTYLE.test(value)) score -= 40;
  if (TIGHT_CROP.test(value)) score -= 45;
  if (SCENE7_CROP_VIEW.test(value) || /_b(?:[/?._]|$)/i.test(value) && /urbndata|scene7/i.test(value)) {
    score -= 35;
  }
  if (PACKSHOT_HINT.test(value)) score += 18;
  if (/cdn\.shopify\.com/i.test(value) && !TIGHT_CROP.test(value)) score += 6;
  return score;
}

export function pickBestCoverImage(urls: string[]): string | null {
  const unique = [...new Set(urls.filter(Boolean))];
  if (unique.length === 0) return null;
  const ranked = unique
    .map((url, index) => ({ url, score: scoreCoverImageUrl(url), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0]?.url ?? null;
}
