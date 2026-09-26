export const GALLERY_MIN_SCALE = 1;
export const GALLERY_MAX_SCALE = 4;
export const GALLERY_DOUBLE_CLICK_SCALE = 2.5;

export interface GalleryPoint {
  x: number;
  y: number;
}

export interface GalleryTransform {
  scale: number;
  x: number;
  y: number;
}

export const IDENTITY_TRANSFORM: GalleryTransform = { scale: 1, x: 0, y: 0 };

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampScale(scale: number): number {
  return clampNumber(scale, GALLERY_MIN_SCALE, GALLERY_MAX_SCALE);
}

export function resetTransform(): GalleryTransform {
  return { ...IDENTITY_TRANSFORM };
}

export function panLimit(scale: number): number {
  return 220 * Math.max(0, scale - 1);
}

export function applyPan(
  current: GalleryTransform,
  dx: number,
  dy: number,
): GalleryTransform {
  if (current.scale <= GALLERY_MIN_SCALE) {
    return resetTransform();
  }
  const limit = panLimit(current.scale);
  return {
    scale: current.scale,
    x: clampNumber(current.x + dx, -limit, limit),
    y: clampNumber(current.y + dy, -limit, limit),
  };
}

export function scaleFromWheelDelta(currentScale: number, deltaY: number): number {
  const factor = deltaY > 0 ? 0.9 : 1.1;
  return clampScale(currentScale * factor);
}

export function applyWheelZoom(
  current: GalleryTransform,
  deltaY: number,
): GalleryTransform {
  const nextScale = scaleFromWheelDelta(current.scale, deltaY);
  if (nextScale <= GALLERY_MIN_SCALE) return resetTransform();
  const ratio = nextScale / current.scale;
  return {
    scale: nextScale,
    x: current.x * ratio,
    y: current.y * ratio,
  };
}

export function toggleDoubleClickZoom(current: GalleryTransform): GalleryTransform {
  if (current.scale > GALLERY_MIN_SCALE + 0.05) return resetTransform();
  return { scale: GALLERY_DOUBLE_CLICK_SCALE, x: 0, y: 0 };
}

export function touchDistance(a: GalleryPoint, b: GalleryPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function isPinchGesture(touchCount: number): boolean {
  return touchCount >= 2;
}

export function pinchScale(
  startDistance: number,
  currentDistance: number,
  startScale: number,
): number {
  if (startDistance <= 0) return clampScale(startScale);
  return clampScale(startScale * (currentDistance / startDistance));
}

export function applyPinchZoom(
  start: GalleryTransform,
  startDistance: number,
  currentDistance: number,
): GalleryTransform {
  const scale = pinchScale(startDistance, currentDistance, start.scale);
  if (scale <= GALLERY_MIN_SCALE) return resetTransform();
  const ratio = scale / Math.max(start.scale, GALLERY_MIN_SCALE);
  const next = {
    scale,
    x: start.x * ratio,
    y: start.y * ratio,
  };
  const limit = panLimit(scale);
  return {
    scale,
    x: clampNumber(next.x, -limit, limit),
    y: clampNumber(next.y, -limit, limit),
  };
}

export function galleryTransformStyle(transform: GalleryTransform): string {
  return `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
}
