import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ImagePlaceholder from "../radar/ImagePlaceholder";
import {
  imageDedupeKey,
  isValidImageUrl,
  normalizeProductImageUrls,
  resolveDisplayImage,
  PRODUCT_GRID_SIZES,
} from "../../images/resolveImageQuality";

export const PRODUCT_PHOTO_FIT_CLASS = "h-full w-full object-contain object-center";
import {
  nextCarouselIndex,
  prevCarouselIndex,
  resolveSwipeDirection,
} from "./carouselNavigation";

interface VisualWallImageCarouselProps {
  images: string[];
  alt: string;
  onImageClick?: () => void;
  hideControlsUntilHover?: boolean;
  priority?: boolean;
}

export default function VisualWallImageCarousel({
  images,
  alt,
  onImageClick,
  hideControlsUntilHover = false,
  priority = false,
}: VisualWallImageCarouselProps) {
  const initialImages = useMemo(
    () => normalizeProductImageUrls(images),
    [images],
  );
  const [failedKeys, setFailedKeys] = useState<Set<string>>(() => new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);

  const visibleImages = useMemo(() => {
    if (failedKeys.size === 0) return initialImages;
    return initialImages.filter((url) => !failedKeys.has(imageDedupeKey(url)));
  }, [failedKeys, initialImages]);

  useEffect(() => {
    setCurrentIndex(0);
    setFailedKeys(new Set());
  }, [initialImages]);

  useEffect(() => {
    if (visibleImages.length === 0) {
      setCurrentIndex(0);
      return;
    }
    if (currentIndex >= visibleImages.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, visibleImages.length]);

  const hasMultipleImages = visibleImages.length > 1;
  const activeImage = visibleImages[currentIndex] ?? null;
  const displayImage = resolveDisplayImage(activeImage, PRODUCT_GRID_SIZES, visibleImages);

  const goNext = useCallback(
    (event?: React.MouseEvent | React.TouchEvent) => {
      event?.stopPropagation();
      event?.preventDefault();
      setCurrentIndex((index) => nextCarouselIndex(index, visibleImages.length));
    },
    [visibleImages.length],
  );

  const goPrev = useCallback(
    (event?: React.MouseEvent | React.TouchEvent) => {
      event?.stopPropagation();
      event?.preventDefault();
      setCurrentIndex((index) => prevCarouselIndex(index, visibleImages.length));
    },
    [visibleImages.length],
  );

  const handleImageError = useCallback(() => {
    if (!activeImage) return;
    const key = imageDedupeKey(activeImage);
    setFailedKeys((previous) => {
      if (previous.has(key)) return previous;
      const next = new Set(previous);
      next.add(key);
      return next;
    });
  }, [activeImage]);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  }, []);

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      if (!hasMultipleImages) return;
      const startX = touchStartXRef.current;
      touchStartXRef.current = null;
      if (startX == null) return;

      const endX = event.changedTouches[0]?.clientX ?? startX;
      const direction = resolveSwipeDirection(startX, endX);
      if (direction === "next") goNext(event);
      if (direction === "prev") goPrev(event);
    },
    [goNext, goPrev, hasMultipleImages],
  );

  if (visibleImages.length === 0 || !isValidImageUrl(activeImage) || !displayImage) {
    return (
      <ImagePlaceholder alt={alt} className="h-full w-full" label="Görsel yok" />
    );
  }

  return (
    <div
      className="relative h-full w-full touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        onClick={onImageClick}
        className="block h-full w-full text-left"
        aria-label={`${alt} — ürüne git`}
      >
        <img
          key={activeImage}
          src={displayImage.src}
          srcSet={displayImage.srcSet}
          sizes={displayImage.sizes}
          alt={alt}
          loading={priority && currentIndex === 0 ? "eager" : "lazy"}
          decoding="async"
          onError={handleImageError}
          className={PRODUCT_PHOTO_FIT_CLASS}
        />
      </button>

      {hasMultipleImages && (
        <>
          <button
            type="button"
            data-carousel-control
            onClick={goPrev}
            aria-label="Önceki fotoğraf"
            className={`absolute left-1.5 top-1/2 z-10 -translate-y-1/2 border border-line bg-white/85 px-1.5 py-1 text-[11px] leading-none text-ink-muted transition-all hover:border-ink hover:text-ink sm:left-2 ${
              hideControlsUntilHover
                ? "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                : ""
            }`}
          >
            ‹
          </button>
          <button
            type="button"
            data-carousel-control
            onClick={goNext}
            aria-label="Sonraki fotoğraf"
            className={`absolute right-1.5 top-1/2 z-10 -translate-y-1/2 border border-line bg-white/85 px-1.5 py-1 text-[11px] leading-none text-ink-muted transition-all hover:border-ink hover:text-ink sm:right-2 ${
              hideControlsUntilHover
                ? "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                : ""
            }`}
          >
            ›
          </button>
          <span
            className={`absolute bottom-1.5 right-1.5 z-10 border border-line bg-white/85 px-1.5 py-0.5 text-[8px] tabular-nums tracking-[0.08em] text-ink-muted ${
              hideControlsUntilHover
                ? "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                : ""
            }`}
          >
            {currentIndex + 1} / {visibleImages.length}
          </span>
        </>
      )}
    </div>
  );
}
