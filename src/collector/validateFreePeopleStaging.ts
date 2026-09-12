import { FREE_PEOPLE_ID } from "./freePeople";
import { freePeopleCatalogIdentity } from "./mergeFreePeopleStaging";
import type { PilotProduct } from "./types";

export function validateFreePeopleStaging(products: readonly PilotProduct[]): string[] {
  const errors: string[] = [];
  if (products.length <= 0) {
    errors.push("staging product count must be greater than 0");
    return errors;
  }

  const brands = new Set(products.map((product) => product.brand.trim()).filter(Boolean));
  if (brands.size <= 0) {
    errors.push("staging must include at least one brand");
  }

  const emptyBrand = products.filter((product) => !product.brand.trim()).length;
  const emptyColor = products.filter((product) => !String(product.color ?? "").trim()).length;
  if (emptyBrand) errors.push(`empty brands: ${emptyBrand}`);
  if (emptyColor) errors.push(`empty colors: ${emptyColor}`);

  const wrongSource = products.filter((product) => product.source !== FREE_PEOPLE_ID);
  if (wrongSource.length) errors.push(`non free-people source rows: ${wrongSource.length}`);

  const mappedHouse = products.filter((product) => product.brand.trim().toUpperCase() === "FREE PEOPLE");
  if (mappedHouse.length) errors.push(`products mapped to FREE PEOPLE brand: ${mappedHouse.length}`);

  const identities = products.map((product) => freePeopleCatalogIdentity(product));
  if (identities.some((identity) => !identity)) {
    errors.push("staging products missing styleNumber identity");
  }

  const counts = new Map<string, number>();
  for (const identity of identities) {
    if (!identity) continue;
    counts.set(identity, (counts.get(identity) ?? 0) + 1);
  }
  const dups = [...counts.entries()].filter(([, count]) => count > 1);
  if (dups.length) errors.push(`duplicate identities: ${dups.length}`);

  return errors;
}
