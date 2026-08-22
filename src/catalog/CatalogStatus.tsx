import { UI_COPY } from "../presentation/turkishLabels";

interface CatalogLoadingStateProps {
  message?: string;
}

export function CatalogLoadingState({
  message = UI_COPY.catalogLoading,
}: CatalogLoadingStateProps) {
  return (
    <p className="px-4 py-10 text-center text-[11px] tracking-wide text-ink-muted">{message}</p>
  );
}

interface CatalogErrorStateProps {
  onRetry?: () => void;
}

export function CatalogErrorState({ onRetry }: CatalogErrorStateProps) {
  return (
    <div className="space-y-3 px-4 py-10 text-center">
      <p className="text-[11px] tracking-wide text-ink-muted">{UI_COPY.catalogLoadError}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="border border-line px-3 py-1.5 text-[10px] tracking-widest text-ink-muted hover:border-ink hover:text-ink"
        >
          {UI_COPY.retry}
        </button>
      ) : null}
    </div>
  );
}
