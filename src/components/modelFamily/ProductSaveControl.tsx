import { useId, useState } from "react";

import { UI_COPY } from "../../presentation/turkishLabels";

interface ProductSaveControlProps {
  saved: boolean;
  note: string | null;
  className: string;
  onSave: (saved: boolean, note?: string) => void;
  onComposeChange?: (open: boolean) => void;
}

export default function ProductSaveControl({
  saved,
  note,
  className,
  onSave,
  onComposeChange,
}: ProductSaveControlProps) {
  const inputId = useId();
  const [draft, setDraft] = useState<string | null>(null);

  function closeComposer() {
    setDraft(null);
    onComposeChange?.(false);
  }

  if (!saved && draft !== null) {
    const trimmed = draft.trim();
    return (
      <form
        className="w-full space-y-2 border-t border-line pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(true, trimmed || undefined);
          closeComposer();
        }}
      >
        <label htmlFor={inputId} className="block text-xs font-medium text-ink">
          Kaydetme notu (isteğe bağlı)
        </label>
        <textarea
          autoFocus
          id={inputId}
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Bu modeli neden kaydediyorsun?"
          className="w-full resize-y border border-line bg-cream px-2 py-1.5 text-xs text-ink"
        />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="touch-target border border-ink bg-ink px-2 py-1 text-xs text-cream">
            {trimmed ? "Notla kaydet" : "Kaydet"}
          </button>
          <button type="button" onClick={closeComposer} className="touch-target border border-line px-2 py-1 text-xs text-ink-muted hover:border-ink">
            Vazgeç
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (saved) onSave(false);
        else {
          setDraft(note ?? "");
          onComposeChange?.(true);
        }
      }}
      className={className}
    >
      {saved ? UI_COPY.saved : UI_COPY.save}
    </button>
  );
}
