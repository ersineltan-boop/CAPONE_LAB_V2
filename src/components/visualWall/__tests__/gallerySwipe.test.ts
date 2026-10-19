import { describe, expect, it } from "vitest";
import { GallerySwipeGesture } from "../gallerySwipe";

describe("gallery swipe gestures", () => {
  it("changes exactly once in both horizontal directions", () => {
    const swipe = new GallerySwipeGesture();
    swipe.begin(1, 200, 100, true);
    expect(swipe.end(1, 120, 110, true)).toBe("next");
    expect(swipe.end(1, 120, 110, true)).toBeNull();
    swipe.begin(1, 100, 100, true);
    expect(swipe.end(1, 180, 90, true)).toBe("prev");
  });

  it("keeps vertical scrolling and small movements from changing photos", () => {
    const swipe = new GallerySwipeGesture();
    swipe.begin(1, 100, 100, true);
    expect(swipe.end(1, 155, 240, true)).toBeNull();
    swipe.begin(1, 100, 100, true);
    expect(swipe.end(1, 130, 105, true)).toBeNull();
  });

  it("suppresses the click after a drag but preserves a fresh tap", () => {
    const swipe = new GallerySwipeGesture();
    swipe.begin(1, 200, 100, true);
    expect(swipe.move(1, 150, 100)).toBe(true);
    swipe.end(1, 120, 100, true);
    expect(swipe.consumeClick()).toBe(true);
    swipe.begin(2, 100, 100, true);
    expect(swipe.end(2, 100, 100, true)).toBeNull();
    expect(swipe.consumeClick()).toBe(false);
  });

  it("never treats a pinch or its remaining finger as a photo swipe", () => {
    const swipe = new GallerySwipeGesture();
    swipe.begin(1, 200, 100, true);
    swipe.begin(2, 300, 100, true);
    expect(swipe.end(2, 400, 100, true)).toBeNull();
    expect(swipe.end(1, 50, 100, true)).toBeNull();
    swipe.begin(3, 200, 100, true);
    expect(swipe.end(3, 100, 100, true)).toBe("next");
  });

  it("does not navigate while zoomed or with a single photo", () => {
    const swipe = new GallerySwipeGesture();
    swipe.begin(1, 200, 100, false);
    expect(swipe.end(1, 50, 100, false)).toBeNull();
    swipe.begin(2, 200, 100, true);
    expect(swipe.end(2, 50, 100, false)).toBeNull();
  });

  it("discards cancelled and wrong-pointer gestures", () => {
    const swipe = new GallerySwipeGesture();
    swipe.begin(1, 200, 100, true);
    swipe.cancel(1);
    expect(swipe.end(1, 50, 100, true)).toBeNull();
    swipe.begin(2, 200, 100, true);
    expect(swipe.end(3, 50, 100, true)).toBeNull();
    expect(swipe.end(2, 50, 100, true)).toBeNull();
  });

  it("resets a gesture when the selected color or gallery changes", () => {
    const swipe = new GallerySwipeGesture();
    swipe.begin(1, 200, 100, true);
    swipe.move(1, 100, 100);
    swipe.reset();
    expect(swipe.end(1, 50, 100, true)).toBeNull();
    expect(swipe.consumeClick()).toBe(false);
  });
});
