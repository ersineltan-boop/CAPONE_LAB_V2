import { describe, expect, it } from "vitest";

import {
  collectAllProductGalleryImages,
  filterGenuineGalleryImages,
  galleryForSelectedColor,
  isEmptyOrPlaceholderGallery,
  isJunkGalleryImage,
  preserveLastGoodGallery,
} from "../galleryImages";

const HERO = "https://cdn.example.com/products/black-hero.jpg";
const BLACK_SIDE = "https://cdn.example.com/products/black-side.jpg";
const BLACK_BACK = "https://cdn.example.com/products/black-back.jpg";
const CREAM_HERO = "https://cdn.example.com/products/cream-hero.jpg";
const CREAM_SIDE = "https://cdn.example.com/products/cream-side.jpg";

describe("junk gallery rejection", () => {
  it("rejects logo, badge, new tag, navigation, recommendation, placeholder, unrelated, and AI images", () => {
    expect(isJunkGalleryImage("https://cdn.example.com/media/logo/brand.png")).toBe(true);
    expect(isJunkGalleryImage("https://cdn.example.com/badge-new.svg")).toBe(true);
    expect(isJunkGalleryImage("https://cdn.example.com/new-tag.png")).toBe(true);
    expect(isJunkGalleryImage("https://cdn.example.com/navigation/menu-item.jpg")).toBe(true);
    expect(isJunkGalleryImage("https://cdn.example.com/recommended-products/tile.jpg")).toBe(true);
    expect(isJunkGalleryImage("https://cdn.example.com/placeholder.jpg")).toBe(true);
    expect(isJunkGalleryImage("https://cdn.example.com/unrelated/bag.jpg")).toBe(true);
    expect(isJunkGalleryImage("https://cdn.example.com/ai-generated/shoe.png")).toBe(true);
    expect(isJunkGalleryImage("https://cdn.example.com/generated-image/look.jpg")).toBe(true);
    expect(
      isJunkGalleryImage("https://cdn.example.com/products/ok.jpg", "new-in badge"),
    ).toBe(true);
  });

  it("keeps genuine product photos", () => {
    expect(isJunkGalleryImage(HERO)).toBe(false);
    expect(
      filterGenuineGalleryImages([
        HERO,
        "https://cdn.example.com/logo/store.png",
        BLACK_SIDE,
        "https://cdn.example.com/placeholder.webp",
      ]),
    ).toEqual([HERO, BLACK_SIDE]);
  });
});

describe("all-photos gallery", () => {
  it("keeps hero plus every genuine variant gallery image", () => {
    const all = collectAllProductGalleryImages({
      hero: HERO,
      images: [HERO, BLACK_SIDE],
      variants: [
        { id: "black", color: "Black", images: [HERO, BLACK_SIDE, BLACK_BACK] },
        { id: "cream", color: "Cream", images: [CREAM_HERO, CREAM_SIDE] },
        {
          id: "junk",
          color: "Promo",
          images: ["https://cdn.example.com/banner/promo.jpg"],
        },
      ],
    });
    expect(all).toEqual([HERO, BLACK_SIDE, BLACK_BACK, CREAM_HERO, CREAM_SIDE]);
    expect(all).not.toContain("https://cdn.example.com/banner/promo.jpg");
  });
});

describe("color-specific galleries", () => {
  const source = {
    hero: HERO,
    images: [HERO, BLACK_SIDE, CREAM_HERO],
    variants: [
      { id: "black", color: "Black", images: [HERO, BLACK_SIDE, BLACK_BACK] },
      { id: "cream", color: "Cream", images: [CREAM_HERO, CREAM_SIDE] },
    ],
  };

  it("uses only the selected variant's own gallery", () => {
    expect(galleryForSelectedColor(source, "cream")).toEqual([CREAM_HERO, CREAM_SIDE]);
    expect(galleryForSelectedColor(source, "black")).toEqual([
      HERO,
      BLACK_SIDE,
      BLACK_BACK,
    ]);
    expect(galleryForSelectedColor(source, "cream")).not.toContain(BLACK_BACK);
  });
});

describe("last-good gallery preserve", () => {
  const lastGood = [HERO, BLACK_SIDE, BLACK_BACK];

  it("keeps last-good when refresh is empty", () => {
    expect(preserveLastGoodGallery(lastGood, [])).toEqual(lastGood);
    expect(isEmptyOrPlaceholderGallery([])).toBe(true);
  });

  it("keeps last-good when refresh is placeholder or junk only", () => {
    expect(
      preserveLastGoodGallery(lastGood, [
        "https://cdn.example.com/placeholder.png",
        "https://cdn.example.com/logo/brand.svg",
        "https://cdn.example.com/new-badge.jpg",
      ]),
    ).toEqual(lastGood);
    expect(
      isEmptyOrPlaceholderGallery(["https://cdn.example.com/placeholder.png"]),
    ).toBe(true);
  });

  it("uses a genuine refresh and still retains extra last-good frames", () => {
    const refreshed = [
      "https://cdn.example.com/products/black-hero-v2.jpg",
      BLACK_SIDE,
    ];
    expect(preserveLastGoodGallery(lastGood, refreshed)).toEqual([
      "https://cdn.example.com/products/black-hero-v2.jpg",
      BLACK_SIDE,
      HERO,
      BLACK_BACK,
    ]);
  });
});
