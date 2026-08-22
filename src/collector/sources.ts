import { loadBrandRegistry } from "../registry";
import {
  brandToPilotSourceConfig,
  getCollectableBrands,
} from "../registry/collection/brandToCollector";
import type { PilotSourceConfig } from "./types";

/** @deprecated Registry-driven — use loadBrandRegistry() */
export const PILOT_SOURCES: PilotSourceConfig[] = getCollectableBrands(
  loadBrandRegistry().all(),
)
  .filter((entry) => entry.preferPilotCache)
  .map((entry) => brandToPilotSourceConfig(entry))
  .filter((config): config is PilotSourceConfig => config !== null);