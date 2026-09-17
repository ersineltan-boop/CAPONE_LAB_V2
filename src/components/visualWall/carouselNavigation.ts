export const PRODUCT_PHOTO_FIT_CLASS = "h-full w-full object-contain object-center";

export function nextCarouselIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (current + 1) % length;
}

export function prevCarouselIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (current - 1 + length) % length;
}

export function resolveSwipeDirection(
  startX: number,
  endX: number,
  threshold = 40,
): "next" | "prev" | null {
  const delta = endX - startX;
  if (Math.abs(delta) < threshold) return null;
  return delta < 0 ? "next" : "prev";
}
