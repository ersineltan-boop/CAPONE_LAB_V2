import type { TrendCommercialRadarItem } from "../../types/commercialRadar";
import CommercialDecisionBadge from "./CommercialDecisionBadge";
import ReferenceSlot from "./ReferenceSlot";

interface CommercialRadarCardProps {
  item: TrendCommercialRadarItem;
  onDetail: () => void;
}

export default function CommercialRadarCard({
  item,
  onDetail,
}: CommercialRadarCardProps) {
  return (
    <article className="border border-line bg-white/30">
      <div className="border-b border-line-light px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-serif text-lg font-medium tracking-wide sm:text-xl">
              {item.title}
            </h3>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              {item.category} · {item.stage}
              {item.confidence ? ` · ${item.confidence}` : ""}
            </p>
          </div>
          <div>
            <span className="mb-1 block text-[9px] uppercase tracking-[0.12em] text-ink-faint">
              Karar
            </span>
            <CommercialDecisionBadge decision={item.decision} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
        {item.heroReferences.map((ref, i) => (
          <ReferenceSlot key={`${item.id}-hero-${i}`} reference={ref} compact />
        ))}
      </div>

      <div className="grid gap-3 px-4 py-4 text-xs sm:grid-cols-2 sm:px-5 sm:text-[13px] lg:grid-cols-3">
        <div>
          <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            Ne oluyor?
          </dt>
          <dd className="mt-1 leading-snug text-ink">{item.summary}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            Neden şimdi?
          </dt>
          <dd className="mt-1 leading-snug text-ink-muted">{item.whyNow}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            Pazar uygunluğu
          </dt>
          <dd className="mt-1 leading-snug text-ink-muted">
            {item.marketFit
              .slice(0, 4)
              .map((m) => `${m.market}: ${m.level}`)
              .join(" · ")}
            {item.marketFit.length > 4 && " · …"}
          </dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            Üretim
          </dt>
          <dd className="mt-1 text-ink-muted">{item.production}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            SS27 uygunluğu
          </dt>
          <dd className="mt-1 text-ink-muted">{item.seasonFit}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            CAPONE önerisi
          </dt>
          <dd className="mt-1 font-medium text-ink">{item.caponeRecommendation}</dd>
        </div>
      </div>

      <div className="border-t border-line-light px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onDetail}
          className="text-[10px] tracking-widest text-ink underline underline-offset-4 transition-opacity hover:opacity-70"
        >
          DETAYLI İNCELE →
        </button>
      </div>
    </article>
  );
}
