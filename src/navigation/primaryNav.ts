export type AppView =
  | "radar"
  | "visual-wall"
  | "brands"
  | "saved"
  | "marketplaces"
  | "market-research";

export interface PrimaryNavItem {
  id: AppView;
  label: string;
}

export const PRIMARY_NAV_ITEMS: readonly PrimaryNavItem[] = [
  { id: "brands", label: "MARKALAR" },
  { id: "marketplaces", label: "PAZARYERLERİ" },
  { id: "visual-wall", label: "VISUAL" },
  { id: "market-research", label: "PAZAR ARAŞTIRMASI" },
  { id: "saved", label: "KAYDETTİKLERİM" },
];

export function isPrimaryNavView(view: AppView): boolean {
  return PRIMARY_NAV_ITEMS.some((item) => item.id === view);
}
