import type { CaponeDecision } from "../types";

const styles: Record<CaponeDecision, string> = {
  "NUMUNEYE GİR": "border-ink bg-ink text-cream",
  "TAKİP ET": "border-ink bg-cream text-ink",
  BEKLE: "border-line bg-white/50 text-ink-muted",
  "GEÇ KALDIK": "border-line bg-cream-dark/60 text-ink-faint line-through decoration-ink-faint",
};

interface CaponeDecisionBadgeProps {
  decision: CaponeDecision;
  compact?: boolean;
}

export default function CaponeDecisionBadge({
  decision,
  compact,
}: CaponeDecisionBadgeProps) {
  return (
    <span
      className={`inline-block border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] sm:text-[11px] ${styles[decision]}`}
      title={compact ? decision : undefined}
    >
      {decision}
    </span>
  );
}
