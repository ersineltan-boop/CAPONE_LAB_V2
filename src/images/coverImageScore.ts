/**
 * Shared cover/hero image ranking. Prefer packshot-like product frames
 * over lifestyle, collage, and known crop/view suffixes.
 */

const LIFESTYLE =
  /lifestyle|lookbook|editorial|campaign|on[-_]?figure|onbody|worn|street[-_]?style|collage|model[-_]?shot/i;
const TIGHT_CROP = /crop_new|crop-new|cropped|detail[-_]?crop|close[-_]?up/i;
const SCENE7_CROP_VIEW = /\/(?:freepeople|FreePeople)\/[^/?#]*_b(?:[/?._]|$)/i;
const PACKSHOT_HINT =
  /packshot|still[-_]?life|ghost|product[-_]?shot|_e(?:[/?._]|$)|[-_]e\d+(?:[/?._]|$)|_a(?:[/?._]|$)|_01(?:[/?._]|$)|_1(?:[/?._]|$)/i;
const FARFETCH_CDN = /cdn-images\.farfetch-contents\.com/i;
const PACKSHOT_SCORE = 22;

export function scoreCoverImageUrl(url: string): number {
  const value = url.trim();
  if (!value) return -100;
  let score = 10;
  if (LIFESTYLE.test(value)) score -= 40;
  if (TIGHT_CROP.test(value)) score -= 45;
  if (SCENE7_CROP_VIEW.test(value) || (/_b(?:[/?._]|$)/i.test(value) && /urbndata|scene7/i.test(value))) {
    score -= 35;
  }
  if (PACKSHOT_HINT.test(value)) score += 18;
  if (/cdn\.shopify\.com/i.test(value) && !TIGHT_CROP.test(value)) score += 6;
  if (FARFETCH_CDN.test(value) && !LIFESTYLE.test(value) && !TIGHT_CROP.test(value)) {
    score += 8;
  }
  return score;
}

export function pickBestCoverImage(urls: string[]): string | null {
  const unique = [...new Set(urls.filter(Boolean))];
  if (unique.length === 0) return null;
  const ranked = unique
    .map((url, index) => ({ url, score: scoreCoverImageUrl(url), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const packshot = ranked.find((item) => item.score >= PACKSHOT_SCORE);
  const best = ranked[0];
  if (packshot && best && best.score < 16) return packshot.url;
  return best?.url ?? null;
}
