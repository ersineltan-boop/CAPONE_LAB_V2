import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import ImagePlaceholder from "../radar/ImagePlaceholder";
import {
  PRODUCT_PHOTO_FIT_CLASS,
  nextCarouselIndex,
  prevCarouselIndex,
  resolveSwipeDirection,
} from "../visualWall/carouselNavigation";
import {
  filterGenuineGalleryImages,
  galleryForSelectedColor,
  type ProductGalleryColorVariant,
} from "../../images/galleryImages";
import {
  imageDedupeKey,
  isValidImageUrl,
  resolveDisplayImage,
} from "../../images/resolveImageQuality";
import { UI_COPY } from "../../presentation/turkishLabels";
import { useGalleryZoom } from "./useGalleryZoom";

const GALLERY_MODAL_SIZES = "(min-width: 1024px) 80vw, 100vw";

export interface ProductGalleryModalProps {
  open: boolean;
  onClose: () => void;
  alt: string;
  images: string[];
  colorVariants?: ProductGalleryColorVariant[];
  selectedVariantId?: string | null;
  onSelectVariant?: (id: string) => void;
  initialIndex?: number;
}

export default function ProductGalleryModal({
  open,
  onClose,
  alt,
  images,
  colorVariants = [],
  selectedVariantId = null,
  onSelectVariant,
  initialIndex = 0,
}: ProductGalleryModalProps) {
  const colors = useMemo(
    () =>
      colorVariants
        .map((variant) => ({
          ...variant,
          images: filterGenuineGalleryImages(variant.images),
        }))
        .filter((variant) => variant.images.length > 0),
    [colorVariants],
  );
  const galleryImages = useMemo(
    () =>
      colors.length > 1
        ? galleryForSelectedColor(
            { images, variants: colors },
            selectedVariantId,
          )
        : filterGenuineGalleryImages(images),
    [colors, images, selectedVariantId],
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failedKeys, setFailedKeys] = useState<Set<string>>(() => new Set());
  const touchStartXRef = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const zoom = useGalleryZoom(`${selectedVariantId ?? ""}|${galleryImages[currentIndex] ?? ""}`);

  const visibleImages = useMemo(() => {
    if (failedKeys.size === 0) return galleryImages;
    return galleryImages.filter((url) => !failedKeys.has(imageDedupeKey(url)));
  }, [failedKeys, galleryImages]);

  useEffect(() => {
    if (!open) return;
    const start = Math.min(Math.max(initialIndex, 0), Math.max(galleryImages.length - 1, 0));
    setCurrentIndex(start);
    setFailedKeys(new Set());
  }, [open, galleryImages, initialIndex, selectedVariantId]);

  useEffect(() => {
    if (visibleImages.length === 0) {
      setCurrentIndex(0);
      return;
    }
    if (currentIndex >= visibleImages.length) setCurrentIndex(0);
  }, [currentIndex, visibleImages.length]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    const dialog = dialogRef.current;
    const backgroundElements = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .filter((element) => element !== dialog)
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute("aria-hidden"),
      }));
    document.body.style.overflow = "hidden";
    for (const { element } of backgroundElements) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousBodyOverflow;
      for (const { element, inert, ariaHidden } of backgroundElements) {
        element.inert = inert;
        if (ariaHidden == null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
      previouslyFocused?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 && !element.closest('[aria-hidden="true"]'),
        );
        if (focusable.length === 0) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
        if (event.shiftKey && activeIndex <= 0) {
          event.preventDefault();
          focusable[focusable.length - 1]?.focus();
        } else if (
          !event.shiftKey &&
          (activeIndex === -1 || activeIndex === focusable.length - 1)
        ) {
          event.preventDefault();
          focusable[0]?.focus();
        }
        return;
      }
      if (event.key === "ArrowRight") {
        setCurrentIndex((index) => nextCarouselIndex(index, visibleImages.length));
        return;
      }
      if (event.key === "ArrowLeft") {
        setCurrentIndex((index) => prevCarouselIndex(index, visibleImages.length));
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoom.zoomIn();
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoom.zoomOut();
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        zoom.reset();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose, open, visibleImages.length, zoom.reset, zoom.zoomIn, zoom.zoomOut]);

  const activeImage = visibleImages[currentIndex] ?? null;
  const displayImage = resolveDisplayImage(activeImage, GALLERY_MODAL_SIZES, visibleImages);
  const hasMultiple = visibleImages.length > 1;
  const selectedColor =
    colors.find((variant) => variant.id === selectedVariantId)?.color ?? null;

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

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      zoom.handlers.onTouchStart(event);
      if (zoom.isZoomed || event.touches.length !== 1) return;
      touchStartXRef.current = event.touches[0]?.clientX ?? null;
    },
    [zoom],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      zoom.handlers.onTouchMove(event);
    },
    [zoom],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      zoom.handlers.onTouchEnd(event);
      if (zoom.isZoomed || !hasMultiple) {
        touchStartXRef.current = null;
        return;
      }
      const startX = touchStartXRef.current;
      touchStartXRef.current = null;
      if (startX == null) return;
      const endX = event.changedTouches[0]?.clientX ?? startX;
      const direction = resolveSwipeDirection(startX, endX);
      if (direction === "next") goNext(event);
      if (direction === "prev") goPrev(event);
    },
    [goNext, goPrev, hasMultiple, zoom],
  );

  useEffect(() => {
    if (!open) return;
    const node = zoom.surfaceRef.current;
    if (!node) return;
    const prevent = (event: Event) => {
      event.preventDefault();
    };
    node.addEventListener("wheel", prevent, { passive: false });
    node.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      node.removeEventListener("wheel", prevent);
      node.removeEventListener("touchmove", prevent);
    };
  }, [open, activeImage, zoom.surfaceRef]);

  if (!open) return null;

  const currentPhoto = visibleImages.length === 0 ? 0 : currentIndex + 1;
  const zoomPercent = Math.round(zoom.transform.scale * 100);

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-product-gallery-modal
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-gallery-live-status
      >
        {UI_COPY.galleryStatus(currentPhoto, visibleImages.length, selectedColor, zoomPercent)}
      </p>

      <div className="relative flex h-full w-full max-w-6xl flex-col border-0 border-line bg-cream shadow-2xl sm:h-[92vh] sm:border">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 id={titleId} className="font-serif text-sm tracking-wide sm:text-lg">
              {UI_COPY.productGallery}
            </h2>
            {selectedColor ? (
              <p className="text-[10px] text-ink-muted">{selectedColor}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label={UI_COPY.galleryZoomControls}
              data-gallery-zoom-controls
            >
              <button
                type="button"
                onClick={zoom.zoomOut}
                disabled={!zoom.isZoomed}
                aria-label={UI_COPY.zoomOut}
                className="border border-line px-2 py-1 text-[11px] text-ink-muted hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                −
              </button>
              <button
                type="button"
                onClick={zoom.reset}
                disabled={!zoom.isZoomed}
                aria-label={UI_COPY.resetZoom}
                className="min-w-12 border border-line px-2 py-1 text-[9px] tabular-nums text-ink-muted hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {zoomPercent}%
              </button>
              <button
                type="button"
                onClick={zoom.zoomIn}
                disabled={zoom.transform.scale >= 4}
                aria-label={UI_COPY.zoomIn}
                className="border border-line px-2 py-1 text-[11px] text-ink-muted hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="border border-line px-2 py-1 text-[10px] tracking-wide text-ink-muted hover:border-ink hover:text-ink"
            >
              {UI_COPY.closeGallery}
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-cream">
          {visibleImages.length === 0 || !isValidImageUrl(activeImage) || !displayImage ? (
            <ImagePlaceholder alt={alt} className="h-full w-full" label="Görsel yok" />
          ) : (
            <div
              ref={zoom.surfaceRef}
              className="relative flex h-full w-full items-center justify-center overflow-hidden"
              data-gallery-zoom-surface
              data-gallery-pinch="true"
              style={{ touchAction: "none", cursor: zoom.isZoomed ? "grab" : "zoom-in" }}
              onWheel={zoom.handlers.onWheel}
              onPointerDown={zoom.handlers.onPointerDown}
              onPointerMove={zoom.handlers.onPointerMove}
              onPointerUp={zoom.handlers.onPointerUp}
              onPointerCancel={zoom.handlers.onPointerCancel}
              onDoubleClick={zoom.handlers.onDoubleClick}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                key={activeImage}
                src={displayImage.src}
                srcSet={displayImage.srcSet}
                sizes={displayImage.sizes}
                alt={alt}
                draggable={false}
                className={`${PRODUCT_PHOTO_FIT_CLASS} max-h-full max-w-full select-none`}
                style={zoom.style}
                onError={() => {
                  if (!activeImage) return;
                  const key = imageDedupeKey(activeImage);
                  setFailedKeys((previous) => {
                    if (previous.has(key)) return previous;
                    const next = new Set(previous);
                    next.add(key);
                    return next;
                  });
                }}
              />

              {hasMultiple ? (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label={UI_COPY.prevPhoto}
                    className="absolute left-2 top-1/2 z-10 -translate-y-1/2 border border-line bg-white/90 px-2 py-1 text-sm text-ink-muted hover:border-ink hover:text-ink"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label={UI_COPY.nextPhoto}
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 border border-line bg-white/90 px-2 py-1 text-sm text-ink-muted hover:border-ink hover:text-ink"
                  >
                    ›
                  </button>
                </>
              ) : null}

              <span className="absolute bottom-2 right-2 z-10 border border-line bg-white/90 px-2 py-0.5 text-[10px] tabular-nums text-ink-muted">
                {UI_COPY.galleryPhotoCount(currentPhoto, visibleImages.length)}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-line px-4 py-3">
          <p className="hidden text-[9px] tracking-[0.12em] text-ink-faint sm:block" data-gallery-zoom-hint>
            {UI_COPY.galleryZoomHint}
          </p>
          <p className="text-[9px] tracking-[0.12em] text-ink-faint sm:hidden" data-gallery-pinch-hint>
            {UI_COPY.galleryPinchHint}
          </p>

          {visibleImages.length > 0 ? (
            <div className="flex gap-1.5 overflow-x-auto" data-gallery-all-photos>
              {visibleImages.map((url, index) => {
                const thumb = resolveDisplayImage(url, "72px");
                const active = index === currentIndex;
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    className={`h-16 w-16 shrink-0 overflow-hidden border ${
                      active ? "border-ink" : "border-line hover:border-ink"
                    }`}
                    aria-label={`${alt} ${index + 1}`}
                    aria-current={active}
                  >
                    {thumb ? (
                      <img
                        src={thumb.src}
                        alt=""
                        className="h-full w-full object-contain object-center"
                      />
                    ) : (
                      <span className="block h-full w-full bg-line/40" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}

          {colors.length > 1 ? (
            <div>
              <p className="mb-1 text-[9px] tracking-[0.16em] text-ink-muted">
                {UI_COPY.colorsHeading}
              </p>
              <div className="flex flex-wrap gap-1.5" data-gallery-color-switch>
                {colors.map((variant) => {
                  const active = variant.id === selectedVariantId;
                  const thumb = variant.images[0];
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => onSelectVariant?.(variant.id)}
                      className={`h-12 w-12 overflow-hidden border ${
                        active ? "border-ink" : "border-line hover:border-ink"
                      }`}
                      title={variant.color ?? undefined}
                      aria-label={variant.color ?? UI_COPY.colorsHeading}
                      aria-pressed={active}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={variant.color ?? ""}
                          className="h-full w-full object-contain object-center"
                        />
                      ) : (
                        <span className="block h-full w-full bg-line/40" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
