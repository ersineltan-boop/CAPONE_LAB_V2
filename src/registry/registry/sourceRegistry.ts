import type { TrendSourceRegistryEntry } from "../types/source";
import { RegistryValidationException } from "../types";
import {
  partitionSourceEntries,
  validateSourceEntries,
} from "../validation/sourceValidation";

export class MasterSourceRegistry {
  private readonly byId: ReadonlyMap<string, TrendSourceRegistryEntry>;
  readonly trendMarket: readonly TrendSourceRegistryEntry[];
  readonly production: readonly TrendSourceRegistryEntry[];

  constructor(entries: readonly TrendSourceRegistryEntry[]) {
    const errors = validateSourceEntries(entries);
    if (errors.length > 0) {
      throw new RegistryValidationException(errors);
    }

    this.byId = new Map(entries.map((entry) => [entry.id.trim(), entry]));

    const partitioned = partitionSourceEntries(entries);
    this.trendMarket = Object.freeze(partitioned.trendMarket);
    this.production = Object.freeze(partitioned.production);
  }

  get size(): number {
    return this.byId.size;
  }

  get(id: string): TrendSourceRegistryEntry | undefined {
    return this.byId.get(id.trim());
  }

  has(id: string): boolean {
    return this.byId.has(id.trim());
  }

  all(): TrendSourceRegistryEntry[] {
    return [...this.byId.values()];
  }

  trendMarketSources(): TrendSourceRegistryEntry[] {
    return [...this.trendMarket];
  }

  productionSources(): TrendSourceRegistryEntry[] {
    return [...this.production];
  }
}

export function createSourceRegistry(
  entries: readonly TrendSourceRegistryEntry[],
): MasterSourceRegistry {
  return new MasterSourceRegistry(entries);
}
