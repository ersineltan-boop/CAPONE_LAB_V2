import { PRIMARY_NAV_ITEMS, isPrimaryNavView, type AppView } from "../navigation/primaryNav";

export type { AppView };

interface HeaderProps {
  onNavigate: (view: AppView) => void;
  currentView: AppView;
}

export default function Header({ onNavigate, currentView }: HeaderProps) {
  const selectValue = isPrimaryNavView(currentView) ? currentView : "brands";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-11 items-center justify-between gap-3 sm:h-12">
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

          <nav className="hidden items-center gap-1 sm:flex sm:flex-wrap">
            {PRIMARY_NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`border px-2.5 py-1.5 text-[10px] tracking-widest transition-colors ${
                  currentView === item.id
                    ? "border-ink bg-ink text-cream"
                    : "border-line text-ink-muted hover:border-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <select
            value={selectValue}
            onChange={(e) => onNavigate(e.target.value as AppView)}
            className="border border-line bg-cream px-2 py-1.5 text-[10px] tracking-wide text-ink-muted sm:hidden"
            aria-label="Sayfa seç"
          >
            {PRIMARY_NAV_ITEMS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
