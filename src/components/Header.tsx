import { CATALOG_NAV_ITEMS, SECONDARY_NAV_ITEMS, type AppView } from "../navigation/primaryNav";
import TeamAccountMenu from "../team/TeamAccountMenu";

export type { AppView };

interface HeaderProps {
  onNavigate: (view: AppView) => void;
  currentView: AppView;
}

const HEADER_LINK_CLASS = "touch-target whitespace-nowrap py-1 underline-offset-[5px] transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink";

export default function Header({ onNavigate, currentView }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-x-6">
          <button
            type="button"
            onClick={() => onNavigate("brands")}
            className="col-start-1 row-start-1 min-w-0 self-center justify-self-start text-left"
          >
            <h1 className="font-serif text-base font-medium tracking-wide sm:text-lg">
              CAPONE LAB
            </h1>
            <p className="truncate text-[10px] tracking-wide text-ink-muted sm:text-[11px]">
              Kadın Ayakkabısı Araştırma
            </p>
          </button>

          <nav aria-label="Ana menü" className="col-span-2 row-start-2 flex min-w-0 flex-col sm:col-span-1 sm:col-start-2 sm:row-start-1">
            <div className="flex flex-wrap items-center gap-x-5 sm:gap-x-6">
              {CATALOG_NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={currentView === item.id ? "page" : undefined}
                  onClick={() => onNavigate(item.id)}
                  className={`${HEADER_LINK_CLASS} text-[13px] font-medium capitalize ${
                    currentView === item.id ? "text-ink underline" : "text-ink-muted"
                  }`}
                >
                  {item.label.toLocaleLowerCase(item.id === "visual-wall" ? "en" : "tr")}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-4">
              {SECONDARY_NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={currentView === item.id ? "page" : undefined}
                  onClick={() => onNavigate(item.id)}
                  className={`${HEADER_LINK_CLASS} capitalize ${
                    item.id === "saved" ? "text-xs font-medium" : "text-[11px]"
                  } ${currentView === item.id ? "text-ink underline" : "text-ink-muted"}`}
                >
                  {item.label.toLocaleLowerCase("tr")}
                </button>
              ))}
            </div>
          </nav>
          <TeamAccountMenu
            className="col-start-2 row-start-1 justify-self-end sm:col-start-3"
            triggerClassName={`${HEADER_LINK_CLASS} text-[13px] font-medium`}
          />
        </div>
      </div>
    </header>
  );
}
