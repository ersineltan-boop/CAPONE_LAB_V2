import type { TrendSource } from "../types";
import Modal from "./Modal";

interface SourcesModalProps {
  open: boolean;
  onClose: () => void;
  trendName: string;
  sources: TrendSource[];
}

export default function SourcesModal({
  open,
  onClose,
  trendName,
  sources,
}: SourcesModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Kaynaklar" wide>
      <p className="mb-6 text-sm text-ink-muted">
        <span className="font-medium text-ink">{trendName}</span> — trend kanıt
        kaynakları
      </p>

      <span className="mb-4 block text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        Demo içerik
      </span>

      <div className="space-y-4">
        {sources.map((source, i) => (
          <article
            key={`${source.brand}-${i}`}
            className="border border-line-light bg-white/50 p-5"
          >
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                  Marka / Kaynak
                </dt>
                <dd className="mt-0.5 font-medium">{source.brand}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                  Ülke
                </dt>
                <dd className="mt-0.5">{source.country}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                  Segment
                </dt>
                <dd className="mt-0.5">{source.segment}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                  Tarih
                </dt>
                <dd className="mt-0.5 tabular-nums">{source.date}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                  Kanıt türü
                </dt>
                <dd className="mt-0.5">{source.evidenceType}</dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-line-light pt-4">
              {source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm tracking-wide text-ink underline underline-offset-4 transition-opacity hover:opacity-70"
                >
                  Orijinal Kaynağa Git →
                </a>
              ) : (
                <span className="text-sm tracking-wide text-ink-faint">
                  Demo kaynak
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </Modal>
  );
}
