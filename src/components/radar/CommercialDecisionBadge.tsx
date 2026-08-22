import type { CommercialDecision } from "../../types/commercialRadar";

const styles: Record<CommercialDecision, string> = {
  "NUMUNEYE GİR": "border-ink bg-ink text-cream",
  HAZIRLAN: "border-ink bg-cream text-ink",
  İZLE: "border-line bg-white/60 text-ink-muted",
  DOYGUN: "border-line bg-cream-dark/80 text-ink-faint",
  "VERİ BİRİKİYOR": "border-line bg-cream/80 text-ink-muted",
};

interface CommercialDecisionBadgeProps {
  decision: CommercialDecision;
}

export default function CommercialDecisionBadge({
  decision,
}: CommercialDecisionBadgeProps) {
  return (
    <span
      className={`inline-block border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] sm:text-[11px] ${styles[decision]}`}
    >
      {decision}
    </span>
  );
}
