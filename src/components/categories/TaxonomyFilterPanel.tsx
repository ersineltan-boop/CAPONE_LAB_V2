import { useState } from "react";

import type { FacetGroup, TaxonomyActiveFilter } from "../../categories/taxonomyFilters";
import {
  getFeatureLabel,
  getTaxonomyValueLabel,
  UI_COPY,
} from "../../presentation/turkishLabels";

interface TaxonomyFilterPanelProps {
  facetGroups: FacetGroup[];
  activeFilters: TaxonomyActiveFilter[];
  onToggleFilter: (field: string, value: string) => void;
  onClearFilters: () => void;
}

function labelForValue(field: string, value: string): string {
  return (
    getTaxonomyValueLabel(value, { field }) ??
    getTaxonomyValueLabel(value) ??
    value.replace(/_/g, " ")
  );
}

function FacetGroupBlock({
  group,
  activeFilters,
  onToggleFilter,
}: {
  group: FacetGroup;
  activeFilters: TaxonomyActiveFilter[];
  onToggleFilter: (field: string, value: string) => void;
}) {
  const isActive = (field: string, value: string) =>
    activeFilters.some((filter) => filter.field === field && filter.value === value);

  return (
    <div>
      <p className="mb-0.5 text-[9px] font-medium tracking-wide text-ink">
        {getFeatureLabel(group.field)}
      </p>
      {group.tier === "limited" && (
        <p className="mb-1.5 text-[8px] text-ink-faint">
          {UI_COPY.coverageLabel(
            group.coverage.known,
            group.coverage.applicable,
            group.coverage.percent,
          )}
        </p>
      )}
      <ul className="space-y-1">
        {group.values.map((entry) => {
          const active = isActive(group.field, entry.value);
          return (
            <li key={`${group.field}-${entry.value}`}>
              <button
                type="button"
                onClick={() => onToggleFilter(group.field, entry.value)}
                className={`flex w-full items-center justify-between gap-2 border px-2 py-1.5 text-left text-[10px] transition-colors ${
                  active
                    ? "border-ink bg-ink text-cream"
                    : "border-line text-ink-muted hover:border-ink"
                }`}
              >
                <span>{labelForValue(group.field, entry.value)}</span>
                <span className="tabular-nums opacity-80">{entry.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function TaxonomyFilterPanel({
  facetGroups,
  activeFilters,
  onToggleFilter,
  onClearFilters,
}: TaxonomyFilterPanelProps) {
  const [limitedOpen, setLimitedOpen] = useState(false);
  if (facetGroups.length === 0) return null;

  const primaryGroups = facetGroups.filter((group) => group.tier === "primary");
  const limitedGroups = facetGroups.filter((group) => group.tier === "limited");

  return (
    <aside className="space-y-4 border border-line bg-cream/30 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-medium tracking-[0.2em] text-ink">
          {UI_COPY.filtersTitle}
        </h3>
        {activeFilters.length > 0 && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-[9px] tracking-wide text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            {UI_COPY.clearFilters}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {primaryGroups.map((group) => (
          <FacetGroupBlock
            key={group.field}
            group={group}
            activeFilters={activeFilters}
            onToggleFilter={onToggleFilter}
          />
        ))}
      </div>

      {limitedGroups.length > 0 && (
        <div className="border-t border-line pt-3">
          <button
            type="button"
            onClick={() => setLimitedOpen((value) => !value)}
            className="flex w-full items-center justify-between text-left text-[9px] tracking-wide text-ink-muted hover:text-ink"
          >
            <span>{UI_COPY.limitedDataFilters}</span>
            <span>{limitedOpen ? "−" : "+"}</span>
          </button>
          {limitedOpen && (
            <div className="mt-3 space-y-4">
              {limitedGroups.map((group) => (
                <FacetGroupBlock
                  key={group.field}
                  group={group}
                  activeFilters={activeFilters}
                  onToggleFilter={onToggleFilter}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
