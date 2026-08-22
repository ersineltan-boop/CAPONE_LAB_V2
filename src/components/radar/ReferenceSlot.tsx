import type { ProductReference } from "../../types/commercialRadar";
import ImagePlaceholder from "./ImagePlaceholder";

interface ReferenceSlotProps {
  reference: ProductReference;
  compact?: boolean;
}

export default function ReferenceSlot({ reference, compact }: ReferenceSlotProps) {
  const label = reference.roleLabel ?? reference.commercialStage;

  return (
    <div className="flex min-w-0 flex-col border border-line-light bg-white/40">
      <div
        className={
          compact
            ? "aspect-[3/4] w-full"
            : "aspect-[4/5] w-full sm:aspect-[3/4]"
        }
      >
        {reference.imageUrl ? (
          <img
            src={reference.imageUrl}
            alt={`${reference.brand} — ${label}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <ImagePlaceholder
            alt={`${reference.brand} — ${label}`}
            className="h-full w-full"
          />
        )}
      </div>
      <div className="border-t border-line-light px-2 py-2">
        <p className="truncate text-[11px] font-medium tracking-wide">
          {reference.brand}
        </p>
        <p className="text-[9px] uppercase tracking-[0.1em] text-ink-faint">
          {label}
        </p>
        {reference.model && (
          <p className="mt-0.5 truncate text-[10px] text-ink-muted">
            {reference.model}
          </p>
        )}
        {reference.externalUrl && (
          <a
            href={reference.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-[9px] tracking-wide text-ink underline underline-offset-2"
          >
            ÜRÜNE GİT ↗
          </a>
        )}
      </div>
    </div>
  );
}
