import {
  isValidImageUrl,
  normalizeProductImageUrls,
} from "./resolveImageQuality";

/**
 * Non-product frames that must never enter a product gallery.
 * Matches logo, badge, new-tag, nav, recommendation, placeholder,
 * unrelated, and AI/generated assets by URL or optional label.
 */
const JUNK_GALLERY_HINTS =
  /\b(logo|badge|favicon|icon|sprite|banner|promo|campaign|hamburger|sticky|label_|wysiwyg|placeholder|\/media\/brands\/|new[-_ ]?in|new[-_ ]?arrival|new[-_]?tag|new[-_]?badge|badge[-_]?new|nav(?:igation)?|menu[-_]?item|recommend(?:ed|ation)?s?|related[-_]?products?|you[-_]?may[-_]?also|complete[-_]?the[-_]?look|shop[-_]?the[-_]?look|unrelated|ai[-_]?generated|generated[-_]?image|midjourney|dall[-_]?e|stable[-_]?diffusion|no[-_]?image|coming[-_]?soon|default[-_]?image)\b/i;

export interface ProductGalleryColorVariant {
  id: string;
  color: string | null;
  images: string[];
}

export interface ProductGallerySource {
  hero?: string | null;
  images?: Array<string | null | undefined>;
  variants?: Array<{
    id?: string;
    color?: string | null;
    images?: Array<string | null | undefined>;
  }>;
}

export function isJunkGalleryImage(
  url: string | null | undefined,
  label?: string | null,
): boolean {
  if (!url || typeof url !== "string") return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (JUNK_GALLERY_HINTS.test(trimmed)) return true;
  if (label && JUNK_GALLERY_HINTS.test(label)) return true;
  return false;
}

export function filterGenuineGalleryImages(
  urls: Array<string | null | undefined>,
  labels: Array<string | null | undefined> = [],
): string[] {
  const kept: string[] = [];
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    if (!isValidImageUrl(url)) continue;
    if (isJunkGalleryImage(url, labels[index] ?? null)) continue;
    kept.push(url);
  }
  return normalizeProductImageUrls(kept);
}

/** Hero first, then every genuine variant gallery frame. */
export function collectAllProductGalleryImages(
  source: ProductGallerySource,
): string[] {
  const variantImages = (source.variants ?? []).flatMap(
    (variant) => variant.images ?? [],
  );
  return filterGenuineGalleryImages([
    source.hero,
    ...(source.images ?? []),
    ...variantImages,
  ]);
}

/** Changing color uses that variant's own gallery only. */
export function galleryForSelectedColor(
  source: ProductGallerySource,
  selectedVariantId: string | null | undefined,
): string[] {
  const variants = source.variants ?? [];
  if (selectedVariantId) {
    const selected = variants.find((variant) => variant.id === selectedVariantId);
    if (selected) {
      const own = filterGenuineGalleryImages(selected.images ?? []);
      if (own.length > 0) return own;
    }
  }
  if (variants.length <= 1) {
    return collectAllProductGalleryImages(source);
  }
  const first = filterGenuineGalleryImages(variants[0]?.images ?? []);
  return first.length > 0 ? first : collectAllProductGalleryImages(source);
}

/**
 * If a refresh returns empty or placeholder-only frames, keep the last-good
 * genuine gallery instead of publishing junk or wiping photos.
 */
export function preserveLastGoodGallery(
  previous: Array<string | null | undefined>,
  incoming: Array<string | null | undefined>,
): string[] {
  const previousGood = filterGenuineGalleryImages(previous);
  const incomingGood = filterGenuineGalleryImages(incoming);
  if (incomingGood.length === 0) return previousGood;
  return normalizeProductImageUrls([...incomingGood, ...previousGood]);
}

export function isEmptyOrPlaceholderGallery(
  urls: Array<string | null | undefined>,
): boolean {
  return filterGenuineGalleryImages(urls).length === 0;
}
