import type { AppView } from "../components/Header";

export interface AppNavigationState {
  view: AppView;
  brandId: string | null;
  brandName: string | null;
  marketplaceId: string | null;
  sourceCategoryId: string | null;
}

const VALID_VIEWS: AppView[] = ["brands", "marketplaces", "saved", "visual-wall", "radar"];

export function parseNavigationFromSearch(search: string): AppNavigationState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const viewParam = params.get("view");
  const view = VALID_VIEWS.includes(viewParam as AppView)
    ? (viewParam as AppView)
    : "brands";

  return {
    view,
    brandId: view === "brands" && params.get("brand") ? params.get("brand") : null,
    brandName: view === "brands" && params.get("brandName") ? params.get("brandName") : null,
    marketplaceId:
      view === "marketplaces" && params.get("marketplace") ? params.get("marketplace") : null,
    sourceCategoryId: params.get("sourceCategory"),
  };
}

export function buildNavigationSearch(state: AppNavigationState): string {
  const params = new URLSearchParams();
  if (state.view !== "brands") {
    params.set("view", state.view);
  }
  if (state.view === "brands" && state.brandId) {
    params.set("brand", state.brandId);
    if (state.brandName) params.set("brandName", state.brandName);
  }
  if (state.view === "marketplaces" && state.marketplaceId) {
    params.set("marketplace", state.marketplaceId);
  }
  if (state.sourceCategoryId) {
    params.set("sourceCategory", state.sourceCategoryId);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function readNavigationFromLocation(): AppNavigationState {
  if (typeof window === "undefined") {
    return {
      view: "brands",
      brandId: null,
      brandName: null,
      marketplaceId: null,
      sourceCategoryId: null,
    };
  }
  return parseNavigationFromSearch(window.location.search);
}

export function writeNavigationToHistory(
  state: AppNavigationState,
  options?: { replace?: boolean },
): void {
  if (typeof window === "undefined") return;
  const search = buildNavigationSearch(state);
  const url = `${window.location.pathname}${search}`;
  if (options?.replace) {
    window.history.replaceState(state, "", url);
  } else {
    window.history.pushState(state, "", url);
  }
}
