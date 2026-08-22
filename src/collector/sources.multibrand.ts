import { loadBrandRegistry } from "../registry";
import {
  brandToPilotSourceConfig,
  getCollectableBrands,
  getProbeCandidateBrands,
  isCollectableBrand,
} from "../registry/collection/brandToCollector";
import type { PilotSourceConfig } from "./types";

/** @deprecated Registry-driven — use loadBrandRegistry().all() */
export function getRegistryPilotSourceConfigs(): PilotSourceConfig[] {
  return getCollectableBrands(loadBrandRegistry().all())
    .filter((entry) => entry.preferPilotCache)
    .map((entry) => brandToPilotSourceConfig(entry))
    .filter((config): config is PilotSourceConfig => config !== null);
}

/** @deprecated Registry-driven — use getCollectableBrands() */
export const NEW_MULTIBRAND_SOURCES: PilotSourceConfig[] = getCollectableBrands(
  loadBrandRegistry().all(),
)
  .filter((entry) => !entry.preferPilotCache)
  .map((entry) => brandToPilotSourceConfig(entry))
  .filter((config): config is PilotSourceConfig => config !== null);

/** @deprecated Registry-driven */
export const EXISTING_PILOT_BRANDS = new Set(
  getCollectableBrands(loadBrandRegistry().all())
    .filter((entry) => entry.preferPilotCache)
    .map((entry) => entry.brand),
);

/** @deprecated Registry-driven */
export const MULTIBRAND_SOURCES: PilotSourceConfig[] = getCollectableBrands(
  loadBrandRegistry().all(),
)
  .map((entry) => brandToPilotSourceConfig(entry))
  .filter((config): config is PilotSourceConfig => config !== null);

export {
  brandToPilotSourceConfig,
  getCollectableBrands,
  getProbeCandidateBrands,
  isCollectableBrand,
};
