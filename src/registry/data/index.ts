import { brandEntries } from "./brands";
import { sourceEntries } from "./sources";
import { createBrandRegistry } from "../registry/brandRegistry";
import { createSourceRegistry } from "../registry/sourceRegistry";
import type { MasterBrandRegistry } from "../registry/brandRegistry";
import type { MasterSourceRegistry } from "../registry/sourceRegistry";

let cachedBrandRegistry: MasterBrandRegistry | null = null;
let cachedSourceRegistry: MasterSourceRegistry | null = null;

/** Doğrulanmış marka registry — data/brands.ts üzerinden yüklenir */
export function loadBrandRegistry(): MasterBrandRegistry {
  if (!cachedBrandRegistry) {
    cachedBrandRegistry = createBrandRegistry(brandEntries);
  }
  return cachedBrandRegistry;
}

/** Doğrulanmış kaynak registry — data/sources.ts üzerinden yüklenir */
export function loadSourceRegistry(): MasterSourceRegistry {
  if (!cachedSourceRegistry) {
    cachedSourceRegistry = createSourceRegistry(sourceEntries);
  }
  return cachedSourceRegistry;
}

/** Test veya runtime güncellemelerinde önbelleği sıfırla */
export function resetRegistryCache(): void {
  cachedBrandRegistry = null;
  cachedSourceRegistry = null;
}

export { brandEntries, sourceEntries };
