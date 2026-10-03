import { resolveViewForRole } from "../auth/permissions";
import type { UserRole } from "../auth/roles";
import type { AppView } from "../components/Header";

export interface AppNavigationState {
  view: AppView;
  brandId: string | null;
  brandName: string | null;
  marketplaceId: string | null;
  sourceCategoryId: string | null;
  marketCountryId: string | null;
  marketBrandId: string | null;
}

const VALID_VIEWS: AppView[] = [
  "brands",
  "marketplaces",
  "brand-automation",
  "saved",
  "visual-wall",
  "radar",
  "market-research",
];

export function emptyNavigation(view: AppView = "brands"): AppNavigationState {
  return {
    view,
    brandId: null,
    brandName: null,
    marketplaceId: null,
    sourceCategoryId: null,
    marketCountryId: view === "market-research" ? "romania" : null,
    marketBrandId: null,
  };
}

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
    sourceCategoryId: view === "market-research" ? null : params.get("sourceCategory"),
    marketCountryId: view === "market-research" ? (params.get("market") ?? "romania") : null,
    marketBrandId: view === "market-research" && params.get("mrBrand") ? params.get("mrBrand") : null,
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
  if (state.view === "market-research") {
    if (state.marketCountryId && state.marketCountryId !== "romania") {
      params.set("market", state.marketCountryId);
    }
    if (state.marketBrandId) params.set("mrBrand", state.marketBrandId);
  }
  if (state.sourceCategoryId && state.view !== "market-research") {
    params.set("sourceCategory", state.sourceCategoryId);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function guardNavigationForRole(
  state: AppNavigationState,
  role: UserRole,
): AppNavigationState {
  const view = resolveViewForRole(state.view, role);
  if (view === state.view) return state;
  return emptyNavigation(view);
}

export function readNavigationFromLocation(): AppNavigationState {
  if (typeof window === "undefined") {
    return emptyNavigation();
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
