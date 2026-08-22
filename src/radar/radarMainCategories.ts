import type { FootwearCategory } from "../types/pilotProduct";
import type {
  MasterRadarBuildResult,
  MasterRadarType,
  MasterRadarView,
  RadarDirectionSignal,
} from "./master/types";
import { filterSignalsForView } from "./master/mapToUi";

/** Radar category navigation — main footwear families only */
export const RADAR_MAIN_CATEGORIES: FootwearCategory[] = [
  "BALLERINA",
  "LOAFER",
  "PUMP",
  "SANDAL",
  "MULE",
  "BOOT",
  "SNEAKER",
];

/** Form/construction attributes — not main nav categories */
export const RADAR_ATTRIBUTE_CATEGORIES: FootwearCategory[] = [
  "SLINGBACK",
  "MARY_JANE",
  "THONG",
  "WEDGE",
];

/** Sub-categories rolled into a main nav tab for display only */
export const RADAR_NAV_ROLLUP: Partial<
  Record<FootwearCategory, FootwearCategory>
> = {
  ANKLE_BOOT: "BOOT",
};

export interface RadarNavCategorySlice {
  category: FootwearCategory;
  earlyCount: number;
  commercialCount: number;
  familyCount: number;
}

export function sourceCategoriesForNav(
  mainCategory: FootwearCategory,
): FootwearCategory[] {
  const rolledIn = Object.entries(RADAR_NAV_ROLLUP)
    .filter(([, target]) => target === mainCategory)
    .map(([source]) => source as FootwearCategory);

  return [mainCategory, ...rolledIn];
}

export function buildRadarNavCategories(
  result: MasterRadarBuildResult,
): RadarNavCategorySlice[] {
  return RADAR_MAIN_CATEGORIES.map((mainCategory) => {
    const sources = sourceCategoriesForNav(mainCategory);
    const slices = result.categories.filter((slice) =>
      sources.includes(slice.category),
    );

    return {
      category: mainCategory,
      earlyCount: slices.reduce(
        (sum, slice) => sum + slice.earlySignals.length,
        0,
      ),
      commercialCount: slices.reduce(
        (sum, slice) => sum + slice.commercialSignals.length,
        0,
      ),
      familyCount: slices.reduce((sum, slice) => sum + slice.familyCount, 0),
    };
  }).filter((slice) => slice.familyCount > 0);
}

export function getNavCategorySignals(
  result: MasterRadarBuildResult,
  mainCategory: FootwearCategory,
  radarType: MasterRadarType,
  view: MasterRadarView,
): RadarDirectionSignal[] {
  const sources = sourceCategoriesForNav(mainCategory);
  const signals = sources.flatMap((category) => {
    const slice = result.categories.find((entry) => entry.category === category);
    if (!slice) return [];
    return radarType === "EARLY"
      ? slice.earlySignals
      : slice.commercialSignals;
  });

  const unique = new Map(signals.map((signal) => [signal.id, signal]));
  return filterSignalsForView([...unique.values()], view);
}

export function defaultRadarNavCategory(
  result: MasterRadarBuildResult,
): FootwearCategory {
  return buildRadarNavCategories(result)[0]?.category ?? "PUMP";
}
