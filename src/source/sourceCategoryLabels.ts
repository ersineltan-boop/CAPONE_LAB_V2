const EXACT_LABELS: Record<string, string> = {
  "ballet flats": "Babet",
  "ballet flat": "Babet",
  ballerina: "Babet",
  ballerinas: "Babet",
  loafer: "Loafer",
  loafers: "Loafer",
  pump: "Topuklu",
  pumps: "Topuklu",
  heels: "Topuklu",
  "court shoes": "Topuklu",
  sandal: "Sandal",
  sandals: "Sandal",
  mule: "Mule",
  mules: "Mule",
  boot: "Bot / Çizme",
  boots: "Bot / Çizme",
  sneaker: "Sneaker",
  sneakers: "Sneaker",
  trainers: "Sneaker",
  trainer: "Sneaker",
  espadrille: "Espadril",
  espadrilles: "Espadril",
  oxford: "Oxford / Derby",
  oxfords: "Oxford / Derby",
  derby: "Oxford / Derby",
  derbys: "Oxford / Derby",
  clog: "Clog",
  clogs: "Clog",
};

/**
 * Display-only Turkish label for a source-native category name.
 * Does not change stored sourceCategoryName / categoryId / membership.
 */
export function translateSourceCategoryLabel(sourceName: string): string {
  const key = sourceName.trim().toLowerCase();
  return EXACT_LABELS[key] ?? sourceName.trim();
}
