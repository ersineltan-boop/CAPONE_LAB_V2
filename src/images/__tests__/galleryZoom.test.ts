import { describe, expect, it } from "vitest";

import {
  IDENTITY_TRANSFORM,
  applyPan,
  applyPinchZoom,
  applyWheelZoom,
  galleryTransformStyle,
  isPinchGesture,
  pinchScale,
  resetTransform,
  toggleDoubleClickZoom,
  touchDistance,
} from "../galleryZoom";

describe("gallery zoom and pan", () => {
  it("zooms in and out with wheel or keyboard-control deltas", () => {
    const wheelZoomed = applyWheelZoom(IDENTITY_TRANSFORM, -120);
    expect(wheelZoomed.scale).toBeGreaterThan(1);
    const wheelOut = applyWheelZoom(wheelZoomed, 400);
    expect(wheelOut.scale).toBeLessThan(wheelZoomed.scale);

    const keyboardZoomed = applyWheelZoom(IDENTITY_TRANSFORM, -1);
    expect(keyboardZoomed.scale).toBeGreaterThan(1);
    const keyboardOut = applyWheelZoom(keyboardZoomed, 1);
    expect(keyboardOut.scale).toBeLessThan(keyboardZoomed.scale);
  });

  it("pans only after zoom and clamps travel", () => {
    expect(applyPan(IDENTITY_TRANSFORM, 80, 40)).toEqual(IDENTITY_TRANSFORM);
    const zoomed = { scale: 2.5, x: 0, y: 0 };
    const panned = applyPan(zoomed, 40, -20);
    expect(panned.x).toBe(40);
    expect(panned.y).toBe(-20);
    const slammed = applyPan(zoomed, 4000, 4000);
    expect(Math.abs(slammed.x)).toBeLessThan(4000);
    expect(Math.abs(slammed.y)).toBeLessThan(4000);
  });

  it("supports pinch zoom from two-touch distance", () => {
    expect(isPinchGesture(1)).toBe(false);
    expect(isPinchGesture(2)).toBe(true);
    expect(touchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(pinchScale(100, 200, 1)).toBe(2);
    const pinched = applyPinchZoom(IDENTITY_TRANSFORM, 80, 160);
    expect(pinched.scale).toBe(2);
    expect(galleryTransformStyle(pinched)).toContain("scale(2)");
  });

  it("double-click toggles zoom and reset restores identity", () => {
    const zoomed = toggleDoubleClickZoom(IDENTITY_TRANSFORM);
    expect(zoomed.scale).toBeGreaterThan(1);
    expect(toggleDoubleClickZoom(zoomed)).toEqual(IDENTITY_TRANSFORM);
    expect(resetTransform()).toEqual(IDENTITY_TRANSFORM);
  });
});
