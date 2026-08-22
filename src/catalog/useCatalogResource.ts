import { useCallback, useEffect, useState } from "react";

export type CatalogLoadStatus<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error" };

export function useCatalogResource<T>(loader: () => Promise<T>, deps: unknown[]): {
  state: CatalogLoadStatus<T>;
  retry: () => void;
} {
  const [state, setState] = useState<CatalogLoadStatus<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loader()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return { state, retry };
}
