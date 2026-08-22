import type { Trend } from "../types";
import StatusBadge from "./StatusBadge";
import OpportunityBadge from "./OpportunityBadge";
import CaponeDecisionBadge from "./CaponeDecisionBadge";
import TrendReferenceImages from "./TrendReferenceImages";

interface TrendCardProps {
  trend: Trend;
  onShowSources: () => void;
  onDeepResearch: () => void;
}

function SpecCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </dt>
      <dd className="mt-0.5 text-xs leading-snug text-ink sm:text-[13px]">
        {value}
      </dd>
    </div>
  );
}

export default function TrendCard({
  trend,
  onShowSources,
  onDeepResearch,
}: TrendCardProps) {
  const colorsLine = trend.colors
    .map((c) => `${c.name} ${c.direction}${c.note ? ` (${c.note})` : ""}`)
    .join(" · ");

  return (
    <article className="border border-line bg-white/30">
      <div className="flex flex-col lg:flex-row">
        <div className="relative mx-auto w-full max-w-[400px] shrink-0 overflow-hidden bg-cream-dark lg:mx-0 lg:h-[280px] lg:w-[300px] xl:w-[340px]">
          <div className="aspect-[5/2] max-h-[140px] sm:max-h-[160px] lg:h-full lg:max-h-none lg:aspect-auto">
            <TrendReferenceImages images={trend.referenceImages} />
          </div>
        </div>

        <div className="min-w-0 flex-1 p-4 sm:p-5 lg:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-serif text-xl font-medium tracking-wide sm:text-2xl">
                {trend.nameTr}
              </h3>
              {trend.name !== trend.nameTr && (
                <p className="mt-0.5 text-[11px] text-ink-faint">{trend.name}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={trend.status} />
              <OpportunityBadge window={trend.opportunityWindow} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-y border-line-light py-2.5">
            <span className="text-[9px] uppercase tracking-[0.14em] text-ink-faint">
              CAPONE Kararı
            </span>
            <CaponeDecisionBadge decision={trend.caponeDecision.decision} />
            <span className="text-[10px] leading-snug text-ink-muted">
              {trend.caponeDecision.rationale}
            </span>
            <span className="text-[8px] uppercase tracking-[0.12em] text-ink-faint">
              Demo
            </span>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-ink-muted sm:text-sm">
            <span className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
              Trend nereye gidiyor? ·{" "}
            </span>
            {trend.direction}
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line-light pt-3 lg:grid-cols-4">
            <SpecCell label="Renk yönü" value={colorsLine} />
            <SpecCell label="Form" value={trend.form} />
            <SpecCell label="Malzeme" value={trend.material} />
            <SpecCell label="Topuk / Taban" value={trend.heelSole} />
            <SpecCell label="Detay & Aksesuar" value={trend.detailAccessory} />
          </dl>

          <p className="mt-2.5 text-xs leading-relaxed text-ink-muted sm:text-sm">
            <span className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
              Neden önemli? ·{" "}
            </span>
            {trend.whyImportantShort}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line-light pt-2.5">
            <span className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
              Kanıt · Demo
            </span>
            <span className="text-xs text-ink-muted">
              {trend.evidence.sourceCount} kaynak ·{" "}
              {trend.evidence.brandCount} bağımsız marka ·{" "}
              {trend.evidence.countryCount} ülke
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onShowSources}
              className="border border-ink px-3.5 py-2 text-[10px] tracking-widest transition-colors hover:bg-ink hover:text-cream"
            >
              KAYNAKLARI GÖR
            </button>
            <button
              type="button"
              onClick={onDeepResearch}
              className="border border-line px-3.5 py-2 text-[10px] tracking-widest text-ink-muted transition-colors hover:border-ink hover:text-ink"
            >
              DERİN ARAŞTIR
            </button>
            <button
              type="button"
              className="border border-line px-3.5 py-2 text-[10px] tracking-widest text-ink-muted transition-colors hover:border-ink hover:text-ink"
            >
              TAKİBE AL
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
