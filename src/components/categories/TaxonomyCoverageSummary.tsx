import { useState } from "react";

import type { FieldCoverageStat } from "../../categories/taxonomyCoverage";
import { getFeatureLabel, UI_COPY } from "../../presentation/turkishLabels";

interface TaxonomyCoverageSummaryProps {
  stats: FieldCoverageStat[];
}

export default function TaxonomyCoverageSummary({ stats }: TaxonomyCoverageSummaryProps) {
  const [open, setOpen] = useState(false);
  if (stats.length === 0) return null;

  const critical = stats.slice(0, 8);

  return (
    <details
      className="inline-block text-[10px] text-ink-muted"
      open={open}
      onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none tracking-wide hover:text-ink">
        {UI_COPY.dataCoverageInfo}
      </summary>
      <ul className="mt-2 space-y-1 rounded border border-line bg-cream/20 p-2 text-[9px]">
        {critical.map((entry) => (
          <li key={entry.field} className="flex items-center justify-between gap-3">
            <span>{getFeatureLabel(entry.field)}</span>
            <span className="tabular-nums">
              {entry.known} / {entry.applicable}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
