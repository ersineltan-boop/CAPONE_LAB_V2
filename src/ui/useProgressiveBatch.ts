import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_BATCH,
  initialVisibleCount,
  nextVisibleCount,
} from "./progressiveBatch";

export { DEFAULT_BATCH, nextVisibleCount, initialVisibleCount };

export function useProgressiveBatch<T>(
  items: T[],
  batchSize = DEFAULT_BATCH,
  resetKey?: unknown,
) {
  const [visibleCount, setVisibleCount] = useState(() =>
    initialVisibleCount(batchSize, items.length),
  );

  useEffect(() => {
    setVisibleCount(initialVisibleCount(batchSize, items.length));
  }, [resetKey, batchSize, items.length]);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );

  const hasMore = visibleCount < items.length;

  const loadMore = useCallback(() => {
    setVisibleCount((count) => nextVisibleCount(count, batchSize, items.length));
  }, [batchSize, items.length]);

  const reset = useCallback(() => {
    setVisibleCount(initialVisibleCount(batchSize, items.length));
  }, [batchSize, items.length]);

  return { visibleItems, hasMore, loadMore, reset, totalCount: items.length, visibleCount };
}
