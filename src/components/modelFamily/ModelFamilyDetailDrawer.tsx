import { useEffect, useState } from "react";

import type { ModelFamily } from "../../modelFamily/types";
import { collectModelFamilyImages } from "../../modelFamily/familyImages";
import {
  colorVariantsForFamily,
  imagesForColorVariant,
  urlForColorVariant,
} from "../../modelFamily/colorVariants";
import { resolveModelFamilyProductUrl } from "../../modelFamily/resolveProductUrl";
import { isVerifiedNew } from "../../newArrivals/newness";
import { UI_COPY } from "../../presentation/turkishLabels";
import {
  CONFIDENCE_LABELS,
  deriveProductSeason,
  LIFECYCLE_LABELS,
  SEASON_LABELS,
} from "../../season/productSeason";
import { formatDateTurkishShort } from "../../presentation/turkishDates";
import { useResearchState } from "../../research/useResearchState";
import VisualWallImageCarousel from "../visualWall/VisualWallImageCarousel";

interface ModelFamilyDetailDrawerProps {
  family: ModelFamily | null;
  open: boolean;
  onClose: () => void;
  onNextUnreviewed?: () => void;
  sourceId?: string | null;
}

export default function ModelFamilyDetailDrawer({
  family,
  open,
  onClose,
  onNextUnreviewed,
  sourceId = null,
}: ModelFamilyDetailDrawerProps) {
  const familyId = family?.modelFamilyId ?? "";
  const { state, setReviewed, setSaved, setNote } = useResearchState(familyId);
  const [noteDraft, setNoteDraft] = useState("");
  const variants = family ? colorVariantsForFamily(family) : [];
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedVariantId(variants[0]?.id ?? null);
    setNoteDraft("");
  }, [familyId]);

  if (!open || !family) return null;

  const images =
    variants.length > 1
      ? imagesForColorVariant(family, selectedVariantId)
      : collectModelFamilyImages(family);
  const productUrl =
    variants.length > 1
      ? urlForColorVariant(family, selectedVariantId)
      : resolveModelFamilyProductUrl(family);
  const selectedColor = variants.find((variant) => variant.id === selectedVariantId)?.color ?? null;
  const sourceCategories = sourceId
    ? family.sourceCategoryRefs?.filter((ref) => ref.sourceId === sourceId) ?? []
    : family.sourceCategoryRefs ?? [];

  const verifiedSightings = (family.sourceSightings ?? []).filter((s) =>
    isVerifiedNew(s.newness),
  );
  const seasonMeta = deriveProductSeason(family);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Kapat"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-lg flex-col border-l border-line bg-cream shadow-xl sm:max-w-xl"
        role="dialog"
        aria-modal="true"
        aria-label={UI_COPY.productDetail}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-serif text-sm tracking-wide">{UI_COPY.productDetail}</h2>
          <button
            type="button"
            onClick={onClose}
            className="border border-line px-2 py-1 text-[10px] tracking-wide text-ink-muted hover:border-ink hover:text-ink"
          >
            Kapat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="relative aspect-[3/4] overflow-hidden border border-line bg-cream">
            <VisualWallImageCarousel
              images={images}
              alt={family.canonicalName}
              colorVariants={variants}
              selectedVariantId={selectedVariantId}
              onSelectVariant={setSelectedVariantId}
            />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              {family.brand}
            </p>
            <h3 className="font-serif text-lg leading-snug">{family.canonicalName}</h3>
            {selectedColor && (
              <p className="text-[10px] text-ink-muted">{selectedColor}</p>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="border border-ink px-2 py-1 text-[9px] tracking-wide">
                {SEASON_LABELS[seasonMeta.season]}
              </span>
              <span className="border border-line px-2 py-1 text-[9px] text-ink-muted">
                {CONFIDENCE_LABELS[seasonMeta.confidence]}
              </span>
              <span className="border border-line px-2 py-1 text-[9px] text-ink-muted">
                {LIFECYCLE_LABELS[seasonMeta.lifecycle]}
              </span>
            </div>
            <p className="text-[9px] text-ink-faint">{seasonMeta.evidence}</p>
          </div>

          {variants.length > 1 && (
            <div>
              <p className="mb-1 text-[9px] tracking-[0.16em] text-ink-muted">
                {UI_COPY.colorsHeading}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {variants.map((variant) => {
                  const active = variant.id === selectedVariantId;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`h-12 w-12 overflow-hidden border ${
                        active ? "border-ink" : "border-line hover:border-ink"
                      }`}
                      title={variant.color ?? undefined}
                    >
                      {variant.thumbnail ? (
                        <img
                          src={variant.thumbnail}
                          alt={variant.color ?? ""}
                          className="h-full w-full object-contain object-center"
                        />
                      ) : (
                        <span className="block h-full w-full bg-line/40" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {sourceCategories.length > 0 && (
            <div>
              <p className="mb-1 text-[9px] tracking-[0.16em] text-ink-muted">
                {UI_COPY.sourceCategoriesDrawer}
              </p>
              <ul className="space-y-1 text-[10px] text-ink-muted">
                {sourceCategories.map((category) => (
                  <li key={`${category.categoryId}-${category.categoryPath}`}>
                    {category.categoryName}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {verifiedSightings.length > 0 && (
            <div className="space-y-1 text-[10px] text-ink-muted">
              <p className="text-[9px] tracking-[0.16em]">{UI_COPY.sourceNewLabel}</p>
              {verifiedSightings.map((sighting) => (
                <p key={sighting.sourceId}>
                  {UI_COPY.verifiedNewEvidence}: {sighting.newness?.evidenceText ?? sighting.sourceLabel}
                  {sighting.newness?.effectiveNewAt && (
                    <>
                      {" "}
                      · {UI_COPY.verifiedNewAt}:{" "}
                      {formatDateTurkishShort(sighting.newness.effectiveNewAt)}
                    </>
                  )}
                </p>
              ))}
            </div>
          )}

          {family.modelFamilyFirstSeenAt && (
            <p className="text-[10px] text-ink-faint">
              {UI_COPY.caponeDiscovered}: {formatDateTurkishShort(family.modelFamilyFirstSeenAt)}
            </p>
          )}

          {family.sourceSightings && family.sourceSightings.length > 0 && (
            <div>
              <p className="mb-1 text-[9px] tracking-[0.16em] text-ink-muted">
                {UI_COPY.source}
              </p>
              <ul className="space-y-1 text-[10px] text-ink-muted">
                {family.sourceSightings.map((sighting) => (
                  <li key={sighting.sourceId}>
                    {sighting.sourceLabel}
                    {sighting.sourceCategories?.[0]?.categoryName
                      ? ` · ${sighting.sourceCategories[0].categoryName}`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setReviewed(!state.reviewedAt)}
              className={`border px-2 py-1 text-[10px] ${
                state.reviewedAt ? "border-ink bg-ink text-cream" : "border-line text-ink-muted"
              }`}
            >
              {state.reviewedAt ? UI_COPY.reviewed : UI_COPY.markReviewed}
            </button>
            <button
              type="button"
              onClick={() => setSaved(!state.savedAt)}
              className={`border px-2 py-1 text-[10px] ${
                state.savedAt ? "border-ink bg-ink text-cream" : "border-line text-ink-muted"
              }`}
            >
              {state.savedAt ? UI_COPY.saved : UI_COPY.save}
            </button>
          </div>

          <div>
            <label className="mb-1 block text-[9px] tracking-[0.16em] text-ink-muted">
              {UI_COPY.productNote}
            </label>
            <textarea
              value={noteDraft || state.note || ""}
              onChange={(event) => setNoteDraft(event.target.value)}
              onBlur={() => setNote(noteDraft)}
              rows={3}
              className="w-full border border-line bg-cream px-2 py-1.5 text-[10px] text-ink"
              placeholder={UI_COPY.addNote}
            />
          </div>

          {productUrl && (
            <a
              href={productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 border border-ink bg-ink px-3 py-2 text-[10px] tracking-widest text-cream transition-colors hover:bg-transparent hover:text-ink"
            >
              {UI_COPY.openAtSource} ↗
            </a>
          )}

          {onNextUnreviewed && (
            <button
              type="button"
              onClick={onNextUnreviewed}
              className="w-full border border-line px-3 py-2 text-[10px] tracking-widest text-ink-muted hover:border-ink hover:text-ink"
            >
              {UI_COPY.nextUnreviewed}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

