import { useId, useState } from "react";
import type { FormEvent } from "react";

import { formatDateTurkishShort } from "../presentation/turkishDates";
import { useTeamAccount } from "./TeamAccountProvider";
import { TEAM_ROLE_LABELS } from "./teamClient";
import { TEAM_NOTE_MAX_LENGTH } from "./useTeamNotes";
import type { TeamNote } from "./useTeamNotes";

interface TeamProductNotesProps {
  notes?: readonly TeamNote[];
  loading: boolean;
  error: string | null;
  onAddNote: (body: string) => Promise<void>;
}

export function TeamProductNotes(props: TeamProductNotesProps) {
  const { member } = useTeamAccount();
  return member ? <TeamNotesContent key={member.user_id} {...props} /> : null;
}

function TeamNotesContent({ notes = [], loading, error, onAddNote }: TeamProductNotesProps) {
  const inputId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !draft?.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onAddNote(draft);
      setDraft(null);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Ekip notu paylaşılamadı.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-2 border-t border-line pt-2" aria-label="Ekip notları">
      {notes.length > 0 ? (
        <>
          <p className="text-xs font-medium text-ink">Ekip notları</p>
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id}>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink [overflow-wrap:anywhere]">
                  {note.body}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted [overflow-wrap:anywhere]">
                  {note.author_name} · {TEAM_ROLE_LABELS[note.author_role]} ·{" "}
                  <time dateTime={note.created_at}>{formatDateTurkishShort(note.created_at)}</time>
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {loading && notes.length === 0 ? (
        <p role="status" className="text-xs text-ink-muted">Ekip notları yükleniyor…</p>
      ) : null}
      {error ? <p role="status" className="text-xs text-ink-muted">{error}</p> : null}

      {draft === null ? (
        <button
          type="button"
          onClick={() => setDraft("")}
          className="touch-target border border-line px-2 py-1 text-xs text-ink hover:border-ink"
        >
          Ekip notu ekle
        </button>
      ) : (
        <form onSubmit={submitNote} className="space-y-2">
          <label htmlFor={inputId} className="block text-xs font-medium text-ink">Ekip notu</label>
          <textarea
            autoFocus
            id={inputId}
            rows={3}
            maxLength={TEAM_NOTE_MAX_LENGTH}
            value={draft}
            readOnly={submitting}
            onChange={(event) => setDraft(event.target.value)}
            className="w-full resize-y border border-line bg-white/60 p-2 text-xs leading-relaxed text-ink"
          />
          {submitError ? <p role="alert" className="text-xs text-ink">{submitError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={submitting || !draft.trim()}
              className="touch-target border border-ink bg-ink px-2 py-1 text-xs text-cream disabled:opacity-50"
            >
              {submitting ? "Paylaşılıyor…" : "Ekip notunu paylaş"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setDraft(null);
                setSubmitError(null);
              }}
              className="touch-target border border-line px-2 py-1 text-xs text-ink-muted hover:border-ink disabled:opacity-50"
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
