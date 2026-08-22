import type { TrendReferenceImage } from "../types";

interface TrendReferenceImagesProps {
  images: [TrendReferenceImage, TrendReferenceImage, TrendReferenceImage];
}

function ImageSlot({ image }: { image: TrendReferenceImage }) {
  if (image.url) {
    return (
      <img
        src={image.url}
        alt={image.alt}
        className="h-full w-full object-cover object-center"
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-cream-dark">
      <span className="text-[8px] tabular-nums text-ink-faint">{image.slot}</span>
      <span className="mt-0.5 text-[7px] uppercase tracking-[0.1em] text-ink-faint">
        —
      </span>
    </div>
  );
}

export default function TrendReferenceImages({ images }: TrendReferenceImagesProps) {
  return (
    <div className="relative flex h-full gap-px bg-line">
      {images.map((image) => (
        <div key={image.slot} className="min-w-0 flex-1">
          <ImageSlot image={image} />
        </div>
      ))}
      <span className="absolute bottom-1.5 left-1.5 bg-cream/90 px-1 py-0.5 text-[7px] uppercase tracking-[0.1em] text-ink-faint">
        Demo · 3 referans
      </span>
    </div>
  );
}
