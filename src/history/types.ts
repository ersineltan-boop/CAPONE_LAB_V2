import type { TagCount } from "../analysis/types";

export type SignalDimension =
  | "category"
  | "colorFamily"
  | "materialFamily"
  | "heelType"
  | "details"
  | "construction"
  | "surfaceEffects";

export interface SnapshotProduct {
  productUrl: string;
  brand: string;
  productName: string;
  imageUrl: string | null;
  category: string | null;
  color: string | null;
  material: string | null;
  colorFamily: string;
  materialFamily: string;
  heelType: string;
  heelHeightGroup: string;
  toeShape: string;
  details: string[];
  construction: string[];
  surfaceEffects: string[];
  firstSeen: string;
  lastSeen: string;
  isNew: boolean;
}

export interface SnapshotSignals {
  category: TagCount[];
  colorFamily: TagCount[];
  materialFamily: TagCount[];
  heelType: TagCount[];
  details: TagCount[];
  construction: TagCount[];
  surfaceEffects: TagCount[];
}

export interface SnapshotSummary {
  collectedAt: string;
  snapshotId: string;
  totalProducts: number;
  totalBrands: number;
  newProductCount: number;
  signals: SnapshotSignals;
}

export interface SnapshotFiles {
  snapshotId: string;
  directory: string;
  products: SnapshotProduct[];
  summary: SnapshotSummary;
}

export interface SignalChange {
  dimension: SignalDimension;
  tag: string;
  labelTr: string;
  previousProductCount: number;
  currentProductCount: number;
  productDelta: number;
  previousBrandCount: number;
  currentBrandCount: number;
  brandDelta: number;
  newlySeenBrands: string[];
  disappearedBrands: string[];
}

export interface TrackedProductRef {
  brand: string;
  productName: string;
  productUrl: string;
  imageUrl: string | null;
  firstSeen: string;
}

export interface RemovedProductRef {
  brand: string;
  productName: string;
  productUrl: string;
  lastSeen: string;
}

export interface ChangeReport {
  generatedAt: string;
  comparisonAvailable: boolean;
  previousSnapshotId: string | null;
  currentSnapshotId: string | null;
  signalChanges: SignalChange[];
  topChanges: SignalChange[];
  newProducts: TrackedProductRef[];
  removedProducts: RemovedProductRef[];
}

export interface ProductSeenRecord {
  productUrl: string;
  firstSeen: string;
  lastSeen: string;
  brand: string;
  productName: string;
  imageUrl: string | null;
}
