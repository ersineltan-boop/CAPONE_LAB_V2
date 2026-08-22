import pilotStateJson from "../../../data/registry/marketplace-pilot.json";

export type MarketplaceSourceKind = "LUXURY_MARKETPLACE";

export type MarketplaceDiscoveryStatus =
  | "ACTIVE"
  | "NEEDS_PROBE"
  | "INACTIVE"
  | "PARTIAL"
  | "BLOCKED";

export type NewArrivalDiscoveryStatus =
  | "VERIFIED"
  | "NEEDS_PROBE"
  | "NOT_SUPPORTED";

export interface MarketplaceRegistryEntry {
  id: string;
  name: string;
  country: string;
  kind: MarketplaceSourceKind;
  officialUrl: string | null;
  isActive: boolean;
  discoveryStatus: MarketplaceDiscoveryStatus;
  newArrivalDiscoveryStatus: NewArrivalDiscoveryStatus;
  newArrivalUrls?: readonly string[];
  newArrivalCollectionHandles?: readonly string[];
  notes: string;
}

export interface MarketplacePilotState {
  activePilotId: string | null;
  mytheresaStatus: "ACTIVE" | "BLOCKED" | "NEEDS_BROWSER_OR_ADAPTER" | "NEEDS_PROBE";
  notes?: string;
}

const MYTHERESA: MarketplaceRegistryEntry = {
  id: "mytheresa",
  name: "Mytheresa",
  country: "DE",
  kind: "LUXURY_MARKETPLACE",
  officialUrl: "https://www.mytheresa.com",
  isActive: true,
  discoveryStatus: "NEEDS_PROBE",
  newArrivalDiscoveryStatus: "NEEDS_PROBE",
  newArrivalUrls: ["https://www.mytheresa.com/us/en/women/shoes/new-arrivals"],
  notes: "Lüks çok markalı pazar yeri — pilot",
};

const FALLBACK_PILOTS: Record<string, MarketplaceRegistryEntry> = {
  ssense: {
    id: "ssense",
    name: "SSENSE",
    country: "CA",
    kind: "LUXURY_MARKETPLACE",
    officialUrl: "https://www.ssense.com",
    isActive: true,
    discoveryStatus: "ACTIVE",
    newArrivalDiscoveryStatus: "NEEDS_PROBE",
    notes: "Fallback luxury marketplace pilot",
  },
  "24s": {
    id: "24s",
    name: "24S",
    country: "FR",
    kind: "LUXURY_MARKETPLACE",
    officialUrl: "https://www.24s.com",
    isActive: true,
    discoveryStatus: "ACTIVE",
    newArrivalDiscoveryStatus: "NEEDS_PROBE",
    notes: "Fallback luxury marketplace pilot",
  },
  luisaviaroma: {
    id: "luisaviaroma",
    name: "LuisaViaRoma",
    country: "IT",
    kind: "LUXURY_MARKETPLACE",
    officialUrl: "https://www.luisaviaroma.com",
    isActive: true,
    discoveryStatus: "ACTIVE",
    newArrivalDiscoveryStatus: "NEEDS_PROBE",
    notes: "Fallback luxury marketplace pilot",
  },
  farfetch: {
    id: "farfetch",
    name: "Farfetch",
    country: "UK",
    kind: "LUXURY_MARKETPLACE",
    officialUrl: "https://www.farfetch.com",
    isActive: true,
    discoveryStatus: "ACTIVE",
    newArrivalDiscoveryStatus: "NEEDS_PROBE",
    notes: "Fallback luxury marketplace pilot",
  },
  "net-a-porter": {
    id: "net-a-porter",
    name: "Net-a-Porter",
    country: "UK",
    kind: "LUXURY_MARKETPLACE",
    officialUrl: "https://www.net-a-porter.com",
    isActive: true,
    discoveryStatus: "ACTIVE",
    newArrivalDiscoveryStatus: "NEEDS_PROBE",
    notes: "Fallback luxury marketplace pilot",
  },
  "moda-operandi": {
    id: "moda-operandi",
    name: "Moda Operandi",
    country: "US",
    kind: "LUXURY_MARKETPLACE",
    officialUrl: "https://www.modaoperandi.com",
    isActive: true,
    discoveryStatus: "ACTIVE",
    newArrivalDiscoveryStatus: "NEEDS_PROBE",
    notes: "Fallback luxury marketplace pilot",
  },
  browns: {
    id: "browns",
    name: "Browns",
    country: "UK",
    kind: "LUXURY_MARKETPLACE",
    officialUrl: "https://www.brownsfashion.com",
    isActive: true,
    discoveryStatus: "ACTIVE",
    newArrivalDiscoveryStatus: "NEEDS_PROBE",
    notes: "Fallback luxury marketplace pilot",
  },
  "level-shoes": {
    id: "level-shoes",
    name: "Level Shoes",
    country: "AE",
    kind: "LUXURY_MARKETPLACE",
    officialUrl: "https://www.levelshoes.com",
    isActive: true,
    discoveryStatus: "ACTIVE",
    newArrivalDiscoveryStatus: "VERIFIED",
    newArrivalUrls: ["https://www.levelshoes.com/women/shoes/new.html"],
    notes: "Fallback luxury marketplace pilot",
  },
};

export const DEFAULT_MARKETPLACE_PILOT_STATE: MarketplacePilotState = {
  activePilotId: "mytheresa",
  mytheresaStatus: "NEEDS_PROBE",
};

export function readMarketplacePilotState(
  raw: MarketplacePilotState = pilotStateJson as MarketplacePilotState,
): MarketplacePilotState {
  return {
    activePilotId: raw.activePilotId ?? "mytheresa",
    mytheresaStatus: raw.mytheresaStatus ?? "NEEDS_PROBE",
    notes: raw.notes,
  };
}

export function selectActiveMarketplaceEntries(
  state: MarketplacePilotState = readMarketplacePilotState(),
): MarketplaceRegistryEntry[] {
  const mytheresaBlocked =
    state.mytheresaStatus === "BLOCKED" ||
    state.mytheresaStatus === "NEEDS_BROWSER_OR_ADAPTER";
  const mytheresa: MarketplaceRegistryEntry = {
    ...MYTHERESA,
    discoveryStatus: state.mytheresaStatus === "ACTIVE"
      ? "ACTIVE"
      : mytheresaBlocked
        ? "BLOCKED"
        : "NEEDS_PROBE",
    isActive: state.activePilotId === "mytheresa" && !mytheresaBlocked,
    notes: mytheresaBlocked ? "BLOCKED / NEEDS_BROWSER_OR_ADAPTER" : MYTHERESA.notes,
  };

  const entries: MarketplaceRegistryEntry[] = [];
  if (mytheresa.isActive) {
    entries.push(mytheresa);
  } else if (state.activePilotId && state.activePilotId !== "mytheresa") {
    entries.push({ ...mytheresa, isActive: false });
    const fallback = FALLBACK_PILOTS[state.activePilotId];
    if (fallback) entries.push(fallback);
  } else {
    entries.push({ ...mytheresa, isActive: false });
  }

  return entries;
}

/** One customer-facing active pilot. Blocked Mytheresa is kept internally. */
export const MARKETPLACE_ENTRIES: readonly MarketplaceRegistryEntry[] =
  selectActiveMarketplaceEntries();

export function loadMarketplaceRegistry(): MarketplaceRegistryEntry[] {
  return selectActiveMarketplaceEntries();
}

export function getMarketplaceById(id: string): MarketplaceRegistryEntry | null {
  return loadMarketplaceRegistry().find((entry) => entry.id === id) ?? null;
}

export function browsableMarketplaces(
  entries: MarketplaceRegistryEntry[] = loadMarketplaceRegistry(),
): MarketplaceRegistryEntry[] {
  return entries.filter((entry) => entry.isActive && entry.discoveryStatus !== "BLOCKED");
}
