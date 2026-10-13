import type {FootwearCategory} from './types';

/** A gallery review is tied to this exact retailer product, style and image. */
export const THE_WEBSTER_TYLER_REVIEW = {
  productId: 7762663669969,
  handle: '1482142-f1338-l305-tyler-lace-up-yellow',
  vendor: 'The Row',
  title: 'Tyler Lace Up YELLOW',
  imageUrl: 'https://cdn.shopify.com/s/files/1/0669/4558/1265/files/01_6e62265e-acc7-4cb7-83f9-4f6406ac9b40.jpg?v=1782218149',
  category: 'BOOT' as const,
  reviewedAt: '2026-10-13',
  evidence: 'Own retailer gallery: ankle-height suede shaft, lace fastening, enclosed moccasin toe and flat sole. Visual category review; not a category inferred from the name Tyler.',
};

export function reviewedTheWebsterCategory(raw: {
  id: number; handle: string; title: string; vendor?: string; body_html?: string;
  images?: Array<{src?: string}>;
}): FootwearCategory | null {
  const review = THE_WEBSTER_TYLER_REVIEW;
  const description = (raw.body_html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (raw.id !== review.productId || raw.handle !== review.handle || raw.title !== review.title ||
      raw.vendor?.trim() !== review.vendor || !/Brand Style:\s*F1338 L305\b/.test(description) ||
      !raw.images?.some(image => image.src === review.imageUrl)) return null;
  return review.category;
}
