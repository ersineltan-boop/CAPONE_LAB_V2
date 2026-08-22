import type { OpportunityWindow } from "../types";

interface OpportunityBadgeProps {
  window: OpportunityWindow;
}

export default function OpportunityBadge({ window: oppWindow }: OpportunityBadgeProps) {
  return (
    <span className="inline-block border border-line bg-white/60 px-2 py-0.5 text-[10px] font-medium tracking-wide text-ink">
      {oppWindow}
    </span>
  );
}
