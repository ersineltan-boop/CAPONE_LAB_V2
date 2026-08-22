import type { Trend } from "../types";
import Modal from "./Modal";

interface DeepResearchModalProps {
  open: boolean;
  onClose: () => void;
  trend: Trend;
}

function DiffusionPath({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
      {steps.map((step, i) => (
        <span key={step} className="flex items-center gap-2">
          {i > 0 && <span className="text-ink-faint">→</span>}
          <span className={i === 0 ? "font-medium text-ink" : ""}>{step}</span>
        </span>
      ))}
    </div>
  );
}

export default function DeepResearchModal({
  open,
  onClose,
  trend,
}: DeepResearchModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Derin Araştır" wide>
      <p className="mb-5 text-sm text-ink-muted">
        <span className="font-medium text-ink">{trend.nameTr}</span>
        {trend.name !== trend.nameTr && (
          <span className="text-ink-faint"> · {trend.name}</span>
        )}
      </p>

      <span className="mb-4 block text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        Demo içerik
      </span>

      <div className="space-y-5">
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-ink-faint">
            6 aylık görünüm
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            {trend.outlook6m}
          </p>
        </section>

        <section className="border-t border-line-light pt-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-ink-faint">
            12 aylık görünüm
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            {trend.outlook12m}
          </p>
        </section>

        <section className="border-t border-line-light pt-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-ink-faint">
            Yayılım
          </h3>
          <div className="mt-2">
            <DiffusionPath steps={trend.diffusion} />
          </div>
        </section>

        <section className="border-t border-line-light pt-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-ink-faint">
            Neden önemli?
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            {trend.whyImportant}
          </p>
        </section>

        <section className="border border-line-light bg-cream/40 p-4">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-ink-faint">
            CAPONE ürün fırsatı
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed">{trend.caponeOpportunity}</p>
        </section>
      </div>
    </Modal>
  );
}
