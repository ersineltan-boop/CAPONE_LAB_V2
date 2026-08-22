import type { CommercialDecision } from "../../types/commercialRadar";

const DECISIONS: CommercialDecision[] = [
  "NUMUNEYE GİR",
  "HAZIRLAN",
  "İZLE",
  "DOYGUN",
  "VERİ BİRİKİYOR",
];

interface DecisionTabsProps {
  active: CommercialDecision | "TÜMÜ";
  counts: Record<CommercialDecision, number>;
  onChange: (decision: CommercialDecision | "TÜMÜ") => void;
}

export default function DecisionTabs({
  active,
  counts,
  onChange,
}: DecisionTabsProps) {
  const tabs: Array<{ key: CommercialDecision | "TÜMÜ"; label: string }> = [
    { key: "TÜMÜ", label: "TÜMÜ" },
    ...DECISIONS.map((d) => ({ key: d, label: d })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const count =
          tab.key === "TÜMÜ"
            ? Object.values(counts).reduce((a, b) => a + b, 0)
            : counts[tab.key];
        const isActive = active === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`border px-3 py-2 text-[10px] tracking-widest transition-colors sm:text-[11px] ${
              isActive
                ? "border-ink bg-ink text-cream"
                : "border-line bg-cream/50 text-ink-muted hover:border-ink hover:text-ink"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 tabular-nums opacity-80">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
