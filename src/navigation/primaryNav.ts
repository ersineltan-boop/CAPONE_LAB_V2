export type AppView =
  | "radar"
  | "visual-wall"
  | "brands"
  | "saved"
  | "marketplaces"
  | "brand-automation"
  | "market-research";

export interface PrimaryNavItem {
  id: AppView;
  label: string;
}

export const CATALOG_NAV_ITEMS: readonly PrimaryNavItem[] = [
  { id: "brands", label: "MARKALAR" },
  { id: "marketplaces", label: "PAZARYERLERİ" },
  { id: "visual-wall", label: "VISUAL" },
];

export const SECONDARY_NAV_ITEMS: readonly PrimaryNavItem[] = [
  { id: "saved", label: "KAYDETTİKLERİM" },
  { id: "brand-automation", label: "MARKA ADAYLARI" },
];

export const PRIMARY_NAV_ITEMS: readonly PrimaryNavItem[] = [
  ...CATALOG_NAV_ITEMS,
  ...SECONDARY_NAV_ITEMS,
];

export function isPrimaryNavView(view: AppView): boolean {
  return PRIMARY_NAV_ITEMS.some((item) => item.id === view);
}
