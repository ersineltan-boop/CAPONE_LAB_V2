/** Trend sinyalinin temel ürün boyutları */
export interface TrendSignalDimensions {
  silhouette: string | null;
  toeShape: string | null;
  heelType: string | null;
  heelHeight: string | null;
  sole: string | null;
  material: string | null;
  color: string | null;
  detail: string | null;
  category: string | null;
}

export const SIGNAL_DIMENSION_KEYS = [
  "silhouette",
  "toeShape",
  "heelType",
  "heelHeight",
  "sole",
  "material",
  "color",
  "detail",
  "category",
] as const satisfies ReadonlyArray<keyof TrendSignalDimensions>;

export type SignalDimensionKey = (typeof SIGNAL_DIMENSION_KEYS)[number];
