import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import Header from "./components/Header";
import BrandsIndex from "./components/brands/BrandsIndex";
import { CatalogLoadingState } from "./catalog/CatalogStatus";
import { loadBrandRegistry } from "./registry/data/index";
import {
  emptyNavigation,
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
const MarketResearchPage = lazy(() => import("./marketResearch/ui/MarketResearchPage"));
const RomaniaBrandDetail = lazy(() => import("./marketResearch/ui/RomaniaBrandDetail"));

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
  const [selectedMarketBrandId, setSelectedMarketBrandId] = useState<string | null>(
    initialNav.marketBrandId,
  );

  const brandRegistry = useMemo(() => loadBrandRegistry(), []);

  const applyNavigation = useCallback((state: AppNavigationState) => {
    setView(state.view);
    setSelectedBrandId(state.brandId);
    setSelectedBrandName(state.brandName);
    setSelectedMarketplaceId(state.marketplaceId);
    setSelectedSourceCategoryId(state.sourceCategoryId);
    setSelectedMarketBrandId(state.marketBrandId);
  }, []);

  const syncNavigation = useCallback(
    (state: AppNavigationState, options?: { replace?: boolean }) => {
      applyNavigation(state);
      writeNavigationToHistory(state, options);
    },
    [applyNavigation],
  );

  useEffect(() => {
    writeNavigationToHistory(initialNav, { replace: true });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      applyNavigation(readNavigationFromLocation());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyNavigation]);

  const navigateToView = useCallback(
    (nextView: AppView) => {
      syncNavigation(emptyNavigation(nextView));
    },
    [syncNavigation],
  );

  const openBrand = useCallback(
    (brandId: string, brandName: string) => {
      syncNavigation({
        ...emptyNavigation("brands"),
        brandId,
        brandName,
      });
    },
    [syncNavigation],
  );

  const backToBrandsIndex = useCallback(() => {
    syncNavigation(emptyNavigation("brands"));
  }, [syncNavigation]);

  const openMarketplace = useCallback(
    (marketplaceId: string) => {
      syncNavigation({
        ...emptyNavigation("marketplaces"),
        marketplaceId,
      });
    },
    [syncNavigation],
  );

  const backToMarketplacesIndex = useCallback(() => {
    syncNavigation(emptyNavigation("marketplaces"));
  }, [syncNavigation]);

  const openMarketResearchBrand = useCallback(
    (brandId: string) => {
      syncNavigation({
        ...emptyNavigation("market-research"),
        marketBrandId: brandId,
      });
    },
    [syncNavigation],
  );

  const backToMarketResearch = useCallback(() => {
    syncNavigation(emptyNavigation("market-research"));
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
          ) : view === "market-research" ? (
            selectedMarketBrandId ? (
              <RomaniaBrandDetail brandId={selectedMarketBrandId} onBack={backToMarketResearch} />
            ) : (
              <MarketResearchPage onSelectBrand={openMarketResearchBrand} />
            )
          ) : view === "marketplaces" ? (
            selectedMarketplaceId ? (
              <MarketplaceDetail
                marketplaceId={selectedMarketplaceId}
                onBack={backToMarketplacesIndex}
                selectedCategoryId={selectedSourceCategoryId}
                onSelectCategory={(categoryId) =>
                  syncNavigation({
                    ...emptyNavigation("marketplaces"),
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
                  ...emptyNavigation("brands"),
                  brandId: selectedBrandId,
                  brandName: resolvedBrandName,
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
