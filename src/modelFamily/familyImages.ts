import type { ModelFamily } from "./types";
import { filterGenuineGalleryImages } from "../images/galleryImages";

/** All unique product images for a Model Family — primary first. */
export function collectModelFamilyImages(family: ModelFamily): string[] {
  return filterGenuineGalleryImages([
    family.representativeImage,
    ...family.representativeImages,
    ...family.allImages,
    ...family.variants.flatMap((variant) => variant.images),
  ]);
}

export function selectAnalysisImages(family: ModelFamily, maxImages = 3): string[] {
  return collectModelFamilyImages(family).slice(0, maxImages);
}

export function imageUrlFingerprint(urls: string[]): string {
  return urls.join("|");
}
