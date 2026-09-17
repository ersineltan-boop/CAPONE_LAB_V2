import {
  PRIMARY_NAV_ITEMS,
  type AppView,
  type PrimaryNavItem,
} from "../navigation/primaryNav";
import type { AppUser, OwnedRecord, UserRole } from "./roles";

export function canSeeMarketResearch(role: UserRole): boolean {
  return role !== "Producer";
}

export function canSeeAllUserRecords(role: UserRole): boolean {
  return role === "Owner";
}

export function isOwner(role: UserRole): boolean {
  return role === "Owner";
}

export function canViewOwnedRecord(viewer: AppUser, ownerUserId: string): boolean {
  if (canSeeAllUserRecords(viewer.role)) return true;
  return viewer.id === ownerUserId;
}

export function filterVisibleRecords<T extends OwnedRecord>(
  records: readonly T[],
  viewer: AppUser,
): T[] {
  return records.filter((record) => canViewOwnedRecord(viewer, record.ownerUserId));
}

export function primaryNavItemsForRole(role: UserRole): readonly PrimaryNavItem[] {
  return PRIMARY_NAV_ITEMS.filter(
    (item) => item.id !== "market-research" || canSeeMarketResearch(role),
  );
}

export function resolveViewForRole(view: AppView, role: UserRole): AppView {
  if (view === "market-research" && !canSeeMarketResearch(role)) {
    return "brands";
  }
  return view;
}

export function marketResearchListForRole<T>(role: UserRole, items: readonly T[]): T[] {
  return canSeeMarketResearch(role) ? [...items] : [];
}
