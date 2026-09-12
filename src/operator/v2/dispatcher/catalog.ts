import { DISPATCHER_DOMAINS, type DispatcherCatalogEntry, type DispatcherDomain } from "./types";

export const DISPATCHER_CATALOG: Record<DispatcherDomain, DispatcherCatalogEntry> = {
  PRODUCT_RESEARCH: {
    domain: "PRODUCT_RESEARCH",
    template: "PRODUCT_RESEARCH",
    priority: "P2",
    risk: "HIGH",
    defaultFiles: ["data/registry/"],
    writesProduction: false,
    startsLiveCollector: false,
    autoMerge: false,
    autoDeploy: false,
  },
  MARKETPLACE_REFRESH: {
    domain: "MARKETPLACE_REFRESH",
    template: "MARKETPLACE_REFRESH",
    priority: "P1",
    risk: "HIGH",
    defaultFiles: ["data/multibrand/"],
    writesProduction: false,
    startsLiveCollector: false,
    autoMerge: false,
    autoDeploy: false,
  },
  MARKET_RESEARCH: {
    domain: "MARKET_RESEARCH",
    template: "MARKET_RESEARCH",
    priority: "P2",
    risk: "HIGH",
    defaultFiles: ["data/market-research/"],
    writesProduction: false,
    startsLiveCollector: false,
    autoMerge: false,
    autoDeploy: false,
  },
  CATALOG_QA: {
    domain: "CATALOG_QA",
    template: "CATALOG_QA",
    priority: "P2",
    risk: "LOW",
    defaultFiles: [".operator/"],
    writesProduction: false,
    startsLiveCollector: false,
    autoMerge: false,
    autoDeploy: false,
  },
  UI_APP: {
    domain: "UI_APP",
    template: "UI_APP",
    priority: "P2",
    risk: "MEDIUM",
    defaultFiles: ["src/App.tsx", "src/components/", "src/ui/"],
    writesProduction: false,
    startsLiveCollector: false,
    autoMerge: false,
    autoDeploy: false,
  },
  BUGFIX: {
    domain: "BUGFIX",
    template: "BUGFIX",
    priority: "P1",
    risk: "MEDIUM",
    defaultFiles: [],
    writesProduction: false,
    startsLiveCollector: false,
    autoMerge: false,
    autoDeploy: false,
  },
};

export function getDispatcherCatalogEntry(domain: DispatcherDomain): DispatcherCatalogEntry {
  return DISPATCHER_CATALOG[domain];
}

export function listDispatcherDomains(): readonly DispatcherDomain[] {
  return DISPATCHER_DOMAINS;
}

export function validateDispatcherCatalog(): string[] {
  const errors: string[] = [];
  const keys = Object.keys(DISPATCHER_CATALOG);
  if (keys.length !== DISPATCHER_DOMAINS.length) {
    errors.push("Phase 3A catalog size does not match dispatcher domains");
  }
  for (const domain of DISPATCHER_DOMAINS) {
    const entry = DISPATCHER_CATALOG[domain];
    if (!entry) {
      errors.push(`Missing Phase 3A catalog entry for ${domain}`);
      continue;
    }
    if (entry.domain !== domain || entry.template !== domain) {
      errors.push(`${domain} catalog domain/template mismatch`);
    }
    if (entry.writesProduction) {
      errors.push(`${domain} must not write production data in Phase 3A`);
    }
    if (entry.startsLiveCollector) {
      errors.push(`${domain} must not start a live collector in Phase 3A`);
    }
    if (entry.autoMerge) {
      errors.push(`${domain} must not auto-merge in Phase 3A`);
    }
    if (entry.autoDeploy) {
      errors.push(`${domain} must not auto-deploy in Phase 3A`);
    }
  }
  return errors;
}
