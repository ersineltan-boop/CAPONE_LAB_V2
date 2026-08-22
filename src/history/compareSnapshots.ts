import { labelTagTr } from "../analysis/buildMarketAnalysis";
import type { TagCount } from "../analysis/types";
import type {
  ChangeReport,
  RemovedProductRef,
  SignalChange,
  SignalDimension,
  SnapshotProduct,
  SnapshotSignals,
  SnapshotSummary,
  TrackedProductRef,
} from "./types";
import { canonicalUrl } from "./buildSnapshot";

function signalKey(dimension: SignalDimension, tag: string): string {
  return `${dimension}::${tag}`;
}

function flattenSignals(signals: SnapshotSignals): Map<string, TagCount & { dimension: SignalDimension }> {
  const map = new Map<string, TagCount & { dimension: SignalDimension }>();
  const dimensions = Object.keys(signals) as SignalDimension[];

  for (const dimension of dimensions) {
    for (const count of signals[dimension]) {
      map.set(signalKey(dimension, count.tag), { ...count, dimension });
    }
  }

  return map;
}

function compareSignalMaps(
  previous: SnapshotSignals,
  current: SnapshotSignals,
): SignalChange[] {
  const previousMap = flattenSignals(previous);
  const currentMap = flattenSignals(current);
  const keys = new Set([...previousMap.keys(), ...currentMap.keys()]);
  const changes: SignalChange[] = [];

  for (const key of keys) {
    const prev = previousMap.get(key);
    const curr = currentMap.get(key);
    if (!prev && !curr) continue;

    const dimension = (curr?.dimension ?? prev?.dimension)!;
    const tag = curr?.tag ?? prev?.tag ?? "";
    const previousBrands = new Set(prev?.brands ?? []);
    const currentBrands = new Set(curr?.brands ?? []);

    changes.push({
      dimension,
      tag,
      labelTr: labelTagTr(tag),
      previousProductCount: prev?.productCount ?? 0,
      currentProductCount: curr?.productCount ?? 0,
      productDelta: (curr?.productCount ?? 0) - (prev?.productCount ?? 0),
      previousBrandCount: prev?.brandCount ?? 0,
      currentBrandCount: curr?.brandCount ?? 0,
      brandDelta: (curr?.brandCount ?? 0) - (prev?.brandCount ?? 0),
      newlySeenBrands: [...currentBrands].filter((brand) => !previousBrands.has(brand)).sort(),
      disappearedBrands: [...previousBrands].filter((brand) => !currentBrands.has(brand)).sort(),
    });
  }

  return changes.sort(
    (a, b) =>
      Math.abs(b.productDelta) - Math.abs(a.productDelta) ||
      Math.abs(b.brandDelta) - Math.abs(a.brandDelta) ||
      a.tag.localeCompare(b.tag),
  );
}

function compareProducts(
  previousProducts: SnapshotProduct[],
  currentProducts: SnapshotProduct[],
): {
  newProducts: TrackedProductRef[];
  removedProducts: RemovedProductRef[];
} {
  const previousByUrl = new Map(
    previousProducts.map((product) => [canonicalUrl(product.productUrl), product]),
  );
  const currentByUrl = new Map(
    currentProducts.map((product) => [canonicalUrl(product.productUrl), product]),
  );

  const newProducts: TrackedProductRef[] = [];
  for (const product of currentProducts) {
    const key = canonicalUrl(product.productUrl);
    if (previousByUrl.has(key)) continue;
    newProducts.push({
      brand: product.brand,
      productName: product.productName,
      productUrl: product.productUrl,
      imageUrl: product.imageUrl,
      firstSeen: product.firstSeen,
    });
  }

  const removedProducts: RemovedProductRef[] = [];
  for (const product of previousProducts) {
    const key = canonicalUrl(product.productUrl);
    if (currentByUrl.has(key)) continue;
    removedProducts.push({
      brand: product.brand,
      productName: product.productName,
      productUrl: product.productUrl,
      lastSeen: product.lastSeen,
    });
  }

  return { newProducts, removedProducts };
}

export function compareSnapshotData(input: {
  previousSnapshotId: string;
  currentSnapshotId: string;
  previousSummary: SnapshotSummary;
  currentSummary: SnapshotSummary;
  previousProducts: SnapshotProduct[];
  currentProducts: SnapshotProduct[];
  generatedAt: string;
}): ChangeReport {
  const signalChanges = compareSignalMaps(
    input.previousSummary.signals,
    input.currentSummary.signals,
  );

  const meaningfulChanges = signalChanges.filter(
    (change) => change.productDelta !== 0 || change.brandDelta !== 0,
  );

  const { newProducts, removedProducts } = compareProducts(
    input.previousProducts,
    input.currentProducts,
  );

  return {
    generatedAt: input.generatedAt,
    comparisonAvailable: true,
    previousSnapshotId: input.previousSnapshotId,
    currentSnapshotId: input.currentSnapshotId,
    signalChanges: meaningfulChanges,
    topChanges: meaningfulChanges.slice(0, 8),
    newProducts,
    removedProducts,
  };
}

export function buildInitialChangeReport(
  currentSnapshotId: string | null,
  generatedAt: string,
): ChangeReport {
  return {
    generatedAt,
    comparisonAvailable: false,
    previousSnapshotId: null,
    currentSnapshotId,
    signalChanges: [],
    topChanges: [],
    newProducts: [],
    removedProducts: [],
  };
}
