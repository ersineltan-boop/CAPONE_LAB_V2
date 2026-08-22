import type { TrendStatus } from "../types";

const statusStyles: Record<TrendStatus, string> = {
  "ERKEN SİNYAL": "border-ink-faint text-ink-muted",
  YÜKSELİYOR: "border-ink-muted text-ink",
  HIZLANIYOR: "border-ink text-ink bg-cream-dark/50",
  "ANA AKIM": "border-ink bg-ink text-cream",
  DOYGUN: "border-line text-ink-faint",
};

interface StatusBadgeProps {
  status: TrendStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}
