import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import Header from "./components/Header";
import BrandsIndex from "./components/brands/BrandsIndex";
import { CatalogLoadingState } from "./catalog/CatalogStatus";
import { loadBrandRegistry } from "./registry/data/index";
import {
  readNavigationFromLocation,
  writeNavigationToHistory,
  type AppNavigationState,
} from "./navigation/appNavigation";
import type { AppView } from "./components/Header";
import { UI_COPY } from "./presentation/turkishLabels";

const BrandDetail = lazy(() => import("./components/brands/BrandDetail"));
const SavedProducts = lazy(() => import("./components/saved/SavedProducts"));
const MarketplacesIndex = lazy(() => import("./components/marketplaces/MarketplacesIndex"));
const MarketplaceDetail = lazy(() => import("./components/marketplaces/MarketplaceDetail"));
const VisualWall = lazy(() => import("./components/visualWall/VisualWall"));

function App() {
  const initialNav = readNavigationFromLocation();
  const [view, setView] = useState<AppView>(initialNav.view);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(initialNav.brandId);
  const [selectedBrandName, setSelectedBrandName] = useState<string | null>(initialNav.brandName);
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string | null>(
    initialNav.marketplaceId,
  );
  const [selectedSourceCategoryId, setSelectedSourceCategoryId] = useState<string | null>(
    initialNav.sourceCategoryId,
  );

  const brandRegistry = useMemo(() => loadBrandRegistry(), []);

  const syncNavigation = useCallback(
    (state: AppNavigationState, options?: { replace?: boolean }) => {
      setView(state.view);
      setSelectedBrandId(state.brandId);
      setSelectedBrandName(state.brandName);
      setSelectedMarketplaceId(state.marketplaceId);
      setSelectedSourceCategoryId(state.sourceCategoryId);
      writeNavigationToHistory(state, options);
    },
    [],
  );

  useEffect(() => {
    writeNavigationToHistory(initialNav, { replace: true });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const next = readNavigationFromLocation();
      setView(next.view);
      setSelectedBrandId(next.brandId);
      setSelectedBrandName(next.brandName);
      setSelectedMarketplaceId(next.marketplaceId);
      setSelectedSourceCategoryId(next.sourceCategoryId);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigateToView = useCallback(
    (nextView: AppView) => {
      syncNavigation({
        view: nextView,
        brandId: null,
        brandName: null,
        marketplaceId: null,
        sourceCategoryId: null,
      });
    },
    [syncNavigation],
  );

  const openBrand = useCallback(
    (brandId: string, brandName: string) => {
      syncNavigation({
        view: "brands",
        brandId,
        brandName,
        marketplaceId: null,
        sourceCategoryId: null,
      });
    },
    [syncNavigation],
  );

  const backToBrandsIndex = useCallback(() => {
    syncNavigation({
      view: "brands",
      brandId: null,
      brandName: null,
      marketplaceId: null,
      sourceCategoryId: null,
    });
  }, [syncNavigation]);

  const openMarketplace = useCallback(
    (marketplaceId: string) => {
      syncNavigation({
        view: "marketplaces",
        brandId: null,
        brandName: null,
        marketplaceId,
        sourceCategoryId: null,
      });
    },
    [syncNavigation],
  );

  const backToMarketplacesIndex = useCallback(() => {
    syncNavigation({
      view: "marketplaces",
      brandId: null,
      brandName: null,
      marketplaceId: null,
      sourceCategoryId: null,
    });
  }, [syncNavigation]);

  const resolvedBrandName =
    selectedBrandName ??
    (selectedBrandId ? brandRegistry.get(selectedBrandId)?.brand ?? null : null);

  return (
    <div className="min-h-screen">
      <Header onNavigate={navigateToView} currentView={view} />

      <main>
        <Suspense fallback={<CatalogLoadingState message={UI_COPY.appLoading} />}>
          {view === "visual-wall" ? (
            <VisualWall />
          ) : view === "saved" ? (
            <SavedProducts onSelectBrand={openBrand} />
          ) : view === "marketplaces" ? (
            selectedMarketplaceId ? (
              <MarketplaceDetail
                marketplaceId={selectedMarketplaceId}
                onBack={backToMarketplacesIndex}
                selectedCategoryId={selectedSourceCategoryId}
                onSelectCategory={(categoryId) =>
                  syncNavigation({
                    view: "marketplaces",
                    brandId: null,
                    brandName: null,
                    marketplaceId: selectedMarketplaceId,
                    sourceCategoryId: categoryId,
                  })
                }
              />
            ) : (
              <MarketplacesIndex onSelectMarketplace={openMarketplace} />
            )
          ) : selectedBrandId && resolvedBrandName ? (
            <BrandDetail
              brandId={selectedBrandId}
              brandName={resolvedBrandName}
              onBack={backToBrandsIndex}
              selectedCategoryId={selectedSourceCategoryId}
              onSelectCategory={(categoryId) =>
                syncNavigation({
                  view: "brands",
                  brandId: selectedBrandId,
                  brandName: resolvedBrandName,
                  marketplaceId: null,
                  sourceCategoryId: categoryId,
                })
              }
            />
          ) : (
            <BrandsIndex onSelectBrand={openBrand} />
          )}
        </Suspense>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <p className="font-serif text-xs tracking-wide sm:text-sm">CAPONE LAB V2</p>
          <p className="text-[9px] uppercase tracking-[0.2em] text-ink-faint">
            Kaynak odaklı ayakkabı araştırması
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
