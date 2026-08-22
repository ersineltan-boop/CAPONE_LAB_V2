import { describe, expect, it } from "vitest";

import { PRODUCT_PHOTO_FIT_CLASS } from "../VisualWallImageCarousel";
import {
  nextCarouselIndex,
  prevCarouselIndex,
  resolveSwipeDirection,
} from "../carouselNavigation";

describe("carouselNavigation", () => {
  it("keeps tall boots fully visible with contain-fit", () => {
    expect(PRODUCT_PHOTO_FIT_CLASS).toContain("object-contain");
    expect(PRODUCT_PHOTO_FIT_CLASS.includes("object-cover")).toBe(false);
  });
  it("wraps next and previous indices", () => {
    expect(nextCarouselIndex(0, 5)).toBe(1);
    expect(nextCarouselIndex(4, 5)).toBe(0);
    expect(prevCarouselIndex(0, 5)).toBe(4);
    expect(prevCarouselIndex(2, 5)).toBe(1);
  });

  it("returns null for small swipe deltas", () => {
    expect(resolveSwipeDirection(100, 120)).toBeNull();
    expect(resolveSwipeDirection(100, 50)).toBe("next");
    expect(resolveSwipeDirection(100, 150)).toBe("prev");
  });
});
