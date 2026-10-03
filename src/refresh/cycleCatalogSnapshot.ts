import { join } from "node:path";
import { loadModelFamilies } from "../modelFamily/dataset";
import { isVerifiedNew } from "../newArrivals/newness";
import { applyMarketplaceDeliveries, loadMarketplaceDeliveries } from "../collector/marketplaceDelivery";
import { buildVisualDelivery } from "../visual/buildVisualDelivery";

export async function cycleCatalogSnapshot(root: string) {
  const core = await loadModelFamilies({ rootDir: join(root, "data/multibrand"), allowMonolithFallback: false });
  if (core.length === 0) throw new Error("Complete model-family dataset is required for an automatic refresh.");
  const families = applyMarketplaceDeliveries(core, await loadMarketplaceDeliveries(root));
  const visual = buildVisualDelivery({ families }).summary;
  const sourceNew: Record<string, number> = {};
  for (const family of families) {
    for (const sighting of family.sourceSightings ?? []) {
      if (isVerifiedNew(sighting.newness)) sourceNew[sighting.sourceId] = (sourceNew[sighting.sourceId] ?? 0) + 1;
    }
  }
  return {
    totalModels: families.length,
    visualModels: visual.totalCount,
    visualVerifiedNewModels: visual.categories.find((category) => category.id === "tumu")?.verifiedNewCount ?? 0,
    verifiedNewModels: families.filter((family) => family.sourceSightings?.some((sighting) => isVerifiedNew(sighting.newness))).length,
    sourceNew,
    modelIds: families.map((family) => family.modelFamilyId),
  };
}
