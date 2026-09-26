import { useCallback, useEffect, useRef, useState } from "react";

import {
  IDENTITY_TRANSFORM,
  applyPan,
  applyPinchZoom,
  applyWheelZoom,
  galleryTransformStyle,
  isPinchGesture,
  resetTransform,
  toggleDoubleClickZoom,
  touchDistance,
  type GalleryTransform,
} from "../../images/galleryZoom";

export function useGalleryZoom(resetKey: string) {
  const [transform, setTransform] = useState<GalleryTransform>(IDENTITY_TRANSFORM);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartRef = useRef<{
    distance: number;
    transform: GalleryTransform;
  } | null>(null);
  const panStartRef = useRef<{
    x: number;
    y: number;
    transform: GalleryTransform;
  } | null>(null);

  useEffect(() => {
    setTransform(resetTransform());
    pointersRef.current.clear();
    pinchStartRef.current = null;
    panStartRef.current = null;
  }, [resetKey]);

  const zoomIn = useCallback(() => {
    setTransform((current) => applyWheelZoom(current, -1));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform((current) => applyWheelZoom(current, 1));
  }, []);

  const reset = useCallback(() => {
    setTransform(resetTransform());
  }, []);

  const onWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    setTransform((current) => applyWheelZoom(current, event.deltaY));
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (event.pointerType === "touch") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      transform,
    };
  }, [transform]);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (event.pointerType === "touch") return;
    const start = panStartRef.current;
    if (!start) return;
    event.preventDefault();
    setTransform(
      applyPan(
        start.transform,
        event.clientX - start.x,
        event.clientY - start.y,
      ),
    );
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    if (event.pointerType === "touch") return;
    panStartRef.current = null;
  }, []);

  const onDoubleClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setTransform((current) => toggleDoubleClickZoom(current));
  }, []);

  const onTouchStart = useCallback((event: React.TouchEvent) => {
    const touches = Array.from(event.touches).map((touch) => ({
      x: touch.clientX,
      y: touch.clientY,
    }));
    if (isPinchGesture(touches.length) && touches[0] && touches[1]) {
      pinchStartRef.current = {
        distance: touchDistance(touches[0], touches[1]),
        transform,
      };
      panStartRef.current = null;
      return;
    }
    const first = touches[0];
    if (first && transform.scale > 1) {
      panStartRef.current = {
        x: first.x,
        y: first.y,
        transform,
      };
    }
  }, [transform]);

  const onTouchMove = useCallback((event: React.TouchEvent) => {
    const touches = Array.from(event.touches).map((touch) => ({
      x: touch.clientX,
      y: touch.clientY,
    }));
    if (isPinchGesture(touches.length) && touches[0] && touches[1] && pinchStartRef.current) {
      event.preventDefault();
      setTransform(
        applyPinchZoom(
          pinchStartRef.current.transform,
          pinchStartRef.current.distance,
          touchDistance(touches[0], touches[1]),
        ),
      );
      return;
    }
    const start = panStartRef.current;
    const first = touches[0];
    if (!start || !first || start.transform.scale <= 1) return;
    event.preventDefault();
    setTransform(applyPan(start.transform, first.x - start.x, first.y - start.y));
  }, []);

  const onTouchEnd = useCallback((event: React.TouchEvent) => {
    if (event.touches.length < 2) pinchStartRef.current = null;
    if (event.touches.length === 0) panStartRef.current = null;
  }, []);

  return {
    transform,
    isZoomed: transform.scale > 1,
    style: {
      transform: galleryTransformStyle(transform),
      transformOrigin: "center center",
      touchAction: "none",
    } as const,
    surfaceRef,
    zoomIn,
    zoomOut,
    reset,
    handlers: {
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onDoubleClick,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
