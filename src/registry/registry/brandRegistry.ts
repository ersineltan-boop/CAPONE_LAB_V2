import type { BrandRegistryEntry } from "../types/brand";
import { RegistryValidationException } from "../types";
import { validateBrandEntries } from "../validation/brandValidation";

export class MasterBrandRegistry {
  private readonly byId: ReadonlyMap<string, BrandRegistryEntry>;

  constructor(entries: readonly BrandRegistryEntry[]) {
    const errors = validateBrandEntries(entries);
    if (errors.length > 0) {
      throw new RegistryValidationException(errors);
    }

    this.byId = new Map(entries.map((entry) => [entry.id.trim(), entry]));
  }

  get size(): number {
    return this.byId.size;
  }

  get(id: string): BrandRegistryEntry | undefined {
    return this.byId.get(id.trim());
  }

  has(id: string): boolean {
    return this.byId.has(id.trim());
  }

  all(): BrandRegistryEntry[] {
    return [...this.byId.values()];
  }

  entries(): IterableIterator<[string, BrandRegistryEntry]> {
    return this.byId.entries();
  }
}

export function createBrandRegistry(
  entries: readonly BrandRegistryEntry[],
): MasterBrandRegistry {
  return new MasterBrandRegistry(entries);
}
