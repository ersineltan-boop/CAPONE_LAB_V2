import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";
import { GallerySwipeGesture } from "./gallerySwipe";

export function useGallerySwipe(
  enabled: boolean,
  resetKey: string,
  onNext: () => void,
  onPrev: () => void,
) {
  const gesture = useRef(new GallerySwipeGesture());
  useEffect(() => gesture.current.reset(), [resetKey]);

  return {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (!event.currentTarget.contains(event.target as Node)) return;
      if (event.button !== 0) return;
      // Controls keep their own click behavior and never start a swipe.
      if ((event.target as Element).closest("[data-carousel-control]")) {
        gesture.current.reset();
        return;
      }
      gesture.current.begin(event.pointerId, event.clientX, event.clientY, enabled);
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      if (!event.currentTarget.contains(event.target as Node)) return;
      if (event.pointerType === "mouse" && event.buttons !== 1) {
        gesture.current.cancel(event.pointerId);
        return;
      }
      if (!enabled) return;
      if (gesture.current.move(event.pointerId, event.clientX, event.clientY)) {
        // Capture only a drag, so an ordinary image click still opens its gallery.
        if (event.pointerType === "mouse") {
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
        }
      }
    },
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      if (!event.currentTarget.contains(event.target as Node)) return;
      const direction = gesture.current.end(
        event.pointerId, event.clientX, event.clientY, enabled,
      );
      if (direction === "next") onNext();
      if (direction === "prev") onPrev();
    },
    onPointerCancel(event: PointerEvent<HTMLDivElement>) {
      if (!event.currentTarget.contains(event.target as Node)) return;
      gesture.current.cancel(event.pointerId);
    },
    onClickCapture(event: MouseEvent<HTMLDivElement>) {
      if (!event.currentTarget.contains(event.target as Node)) return;
      if ((event.target as Element).closest("[data-carousel-control]")) {
        gesture.current.consumeClick();
        return;
      }
      if (event.detail === 0) return;
      if (!gesture.current.consumeClick()) return;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
