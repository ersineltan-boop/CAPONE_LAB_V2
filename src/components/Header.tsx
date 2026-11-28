import { CATALOG_NAV_ITEMS, SECONDARY_NAV_ITEMS, type AppView } from "../navigation/primaryNav";

export type { AppView };

interface HeaderProps {
  onNavigate: (view: AppView) => void;
  currentView: AppView;
}

export default function Header({ onNavigate, currentView }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <button
            type="button"
            onClick={() => onNavigate("brands")}
            className="min-w-0 shrink text-left"
          >
            <h1 className="font-serif text-base font-medium tracking-wide sm:text-lg">
              CAPONE LAB
            </h1>
            <p className="truncate text-[10px] tracking-wide text-ink-muted sm:text-[11px]">
              Kadın Ayakkabısı Araştırma
            </p>
          </button>

          <nav aria-label="Ana menü" className="space-y-0.5">
            <div className="flex flex-wrap gap-1 sm:justify-end">
              {CATALOG_NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={currentView === item.id ? "page" : undefined}
                  onClick={() => onNavigate(item.id)}
                  className={`touch-target border px-2.5 py-1.5 text-[10px] tracking-widest transition-colors ${
                    currentView === item.id
                      ? "border-ink bg-ink text-cream"
                      : "border-line text-ink-muted hover:border-ink"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1 sm:justify-end">
              {SECONDARY_NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={currentView === item.id ? "page" : undefined}
                  onClick={() => onNavigate(item.id)}
                  className={`touch-target px-2.5 py-1 tracking-wide underline-offset-4 hover:underline ${
                    item.id === "brand-automation" ? "text-[9px]" : "text-[10px] font-medium"
                  } ${currentView === item.id ? "text-ink underline" : "text-ink-muted"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
