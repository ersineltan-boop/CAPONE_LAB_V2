import type { TrendSourceConfig } from "../types";

export function createSourceRegistry(
  sources: readonly TrendSourceConfig[],
): ReadonlyMap<string, TrendSourceConfig> {
  return new Map(sources.map((source) => [source.id, source]));
}

export function getActiveSources(
  registry: ReadonlyMap<string, TrendSourceConfig>,
): TrendSourceConfig[] {
  return [...registry.values()].filter((source) => source.isActive);
}

export function getSourcesByRole(
  registry: ReadonlyMap<string, TrendSourceConfig>,
  role: TrendSourceConfig["role"],
): TrendSourceConfig[] {
  return [...registry.values()].filter(
    (source) => source.isActive && source.role === role,
  );
}

export function getProductionSignalSources(
  registry: ReadonlyMap<string, TrendSourceConfig>,
): TrendSourceConfig[] {
  return getSourcesByRole(registry, "PRODUCTION_SIGNAL");
}
