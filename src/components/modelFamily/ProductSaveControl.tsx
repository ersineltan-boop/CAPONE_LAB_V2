import { useEffect, useId, useState } from "react";

import { UI_COPY } from "../../presentation/turkishLabels";
import { useTeamAccount } from "../../team/TeamAccountProvider";
import { useAddTeamNote } from "../../team/useTeamNotes";

interface ProductSaveControlProps {
  modelFamilyId: string;
  saved: boolean;
  note: string | null;
  className: string;
  onSave: (saved: boolean, note?: string) => void;
  onComposeChange?: (open: boolean) => void;
}

export default function ProductSaveControl(props: ProductSaveControlProps) {
  const { member } = useTeamAccount();

  return (
    <ProductSaveComposer
      key={JSON.stringify([props.modelFamilyId, member?.user_id])}
      {...props}
    />
  );
}

function ProductSaveComposer({
  modelFamilyId,
  saved,
  note,
  className,
  onSave,
  onComposeChange,
}: ProductSaveControlProps) {
  const inputId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const addTeamNote = useAddTeamNote();

  useEffect(() => () => onComposeChange?.(false), [onComposeChange]);

  function closeComposer() {
    setDraft(null);
    setShareError("");
    onComposeChange?.(false);
  }

  async function saveWithTeamNote(noteToShare: string) {
    if (!addTeamNote || sharing) return;
    setSharing(true);
    setShareError("");
    try {
      await addTeamNote(modelFamilyId, noteToShare);
      onSave(true);
      closeComposer();
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Ekip notu paylaşılamadı.");
    } finally {
      setSharing(false);
    }
  }

  if (!saved && draft !== null) {
    const trimmed = draft.trim();
    return (
      <form
        className="w-full space-y-2 border-t border-line pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (sharing) return;
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
          disabled={sharing}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Bu modeli neden kaydediyorsun?"
          className="w-full resize-y border border-line bg-cream px-2 py-1.5 text-xs text-ink"
        />
        {shareError && <p role="alert" className="text-xs text-ink">{shareError}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={sharing} className="touch-target border border-ink bg-ink px-2 py-1 text-xs text-cream disabled:opacity-50">
            {trimmed ? (addTeamNote ? "Kişisel notla kaydet" : "Notla kaydet") : "Kaydet"}
          </button>
          {addTeamNote && trimmed && (
            <button
              type="button"
              disabled={sharing}
              onClick={() => void saveWithTeamNote(trimmed)}
              className="touch-target border border-ink px-2 py-1 text-xs text-ink hover:bg-ink hover:text-cream disabled:opacity-50"
            >
              {sharing ? "Paylaşılıyor…" : "Ekiple paylaş ve kaydet"}
            </button>
          )}
          <button type="button" disabled={sharing} onClick={closeComposer} className="touch-target border border-line px-2 py-1 text-xs text-ink-muted hover:border-ink disabled:opacity-50">
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
