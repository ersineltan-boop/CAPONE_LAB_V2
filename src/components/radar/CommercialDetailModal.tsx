import type {
  CommercialStage,
  ProductReference,
  TrendCommercialRadarItem,
} from "../../types/commercialRadar";
import { COMMERCIAL_STAGE_LABELS } from "../../types/commercialRadar";
import Modal from "../Modal";
import CommercialDecisionBadge from "./CommercialDecisionBadge";
import ReferenceSlot from "./ReferenceSlot";

interface CommercialDetailModalProps {
  open: boolean;
  onClose: () => void;
  item: TrendCommercialRadarItem;
}

const DETAIL_SECTIONS: Array<{
  stage: CommercialStage;
  title: string;
  letter: string;
}> = [
  { letter: "A", stage: "DIRECTIONAL", title: "ÖNCÜ / DIRECTIONAL" },
  { letter: "B", stage: "EARLY_COMMERCIAL", title: "ERKEN TİCARİLEŞME" },
  { letter: "C", stage: "COMMERCIAL", title: "TİCARİ DOĞRULAMA" },
  { letter: "D", stage: "MASS_MARKET", title: "MASS MARKET" },
];

function refsForStage(
  refs: ProductReference[],
  stage: CommercialStage,
): ProductReference[] {
  return refs.filter((r) => r.commercialStage === stage);
}

export default function CommercialDetailModal({
  open,
  onClose,
  item,
}: CommercialDetailModalProps) {
  const pt = item.productTranslation;

  return (
    <Modal open={open} onClose={onClose} title={item.title} extraWide>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
          CAPONE Kararı
        </span>
        <CommercialDecisionBadge decision={item.decision} />
        <span className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
          {item.stage}
        </span>
      </div>

      {DETAIL_SECTIONS.map(({ letter, stage, title }) => {
        const stageRefs = refsForStage(item.references, stage);
        if (stageRefs.length === 0) return null;

        return (
          <section key={stage} className="mb-8 border-t border-line-light pt-6">
            <h3 className="font-serif text-base font-medium tracking-wide">
              {letter} — {title}
            </h3>
            <p className="mt-1 text-[10px] text-ink-faint">
              {stageRefs.length} referans ·{" "}
              {COMMERCIAL_STAGE_LABELS[stage]}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {stageRefs.map((ref, i) => (
                <ReferenceSlot
                  key={`${stage}-${ref.brand}-${i}`}
                  reference={ref}
                  compact
                />
              ))}
            </div>
          </section>
        );
      })}

      {item.reverseSeasonReferences.length > 0 && (
        <section className="mb-8 border-t border-line-light pt-6">
          <h3 className="font-serif text-base font-medium tracking-wide">
            TERS SEZON RADARI
          </h3>
          <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {item.reverseSeasonLabel}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {item.reverseSeasonReferences.map((ref, i) => (
              <ReferenceSlot
                key={`reverse-${i}`}
                reference={ref}
                compact
              />
            ))}
          </div>
        </section>
      )}

      <section className="mb-8 border border-line-light bg-cream/40 p-4 sm:p-5">
        <h3 className="font-serif text-base font-medium tracking-wide">
          SS27 İÇİN NE YAPARDIM?
        </h3>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">Form</dt>
            <dd className="mt-0.5">{pt.form}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">Burun</dt>
            <dd className="mt-0.5">{pt.toe}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">Saya</dt>
            <dd className="mt-0.5">{pt.upper}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">Topuk / Taban</dt>
            <dd className="mt-0.5">{pt.heelSole}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">Malzeme</dt>
            <dd className="mt-0.5">{pt.material}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">Renkler</dt>
            <dd className="mt-0.5">{pt.colors.join(" · ")}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">Türkiye üretilebilirliği</dt>
            <dd className="mt-0.5">{pt.turkeyProduction}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">Çin ihtiyacı</dt>
            <dd className="mt-0.5">{pt.chinaNeed}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">Ticari risk</dt>
            <dd className="mt-0.5">{pt.commercialRisk}</dd>
          </div>
          {pt.recommendedSamples.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                Önerilen numune
              </dt>
              <dd className="mt-1 space-y-1">
                {pt.recommendedSamples.map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {item.radarReason && (
        <section className="mb-8 border-t border-line-light pt-5">
          <h3 className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            Neden Radar&apos;da?
          </h3>
          <p className="mt-2 text-xs text-ink-muted">{item.radarReason}</p>
        </section>
      )}

      {item.engineMetrics && (
        <section className="border-t border-line-light pt-5">
          <h3 className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            Neden bu karar? · Motor metrikleri
          </h3>
          <p className="mt-2 text-xs text-ink-muted">
            Güç {item.engineMetrics.trendStrength} · İvme{" "}
            {item.engineMetrics.momentumScore ?? "—"} · Novelty{" "}
            {item.engineMetrics.noveltyScore} · Doygunluk{" "}
            {item.engineMetrics.saturationScore} · Fırsat{" "}
            {item.engineMetrics.opportunityScore}
          </p>
        </section>
      )}
    </Modal>
  );
}
