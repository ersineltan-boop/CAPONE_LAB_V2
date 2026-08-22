export const DEFAULT_BATCH = 48;

export function nextVisibleCount(
  visibleCount: number,
  batchSize: number,
  total: number,
): number {
  if (total <= 0) return 0;
  return Math.min(visibleCount + batchSize, total);
}

export function initialVisibleCount(batchSize: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(batchSize, total);
}
