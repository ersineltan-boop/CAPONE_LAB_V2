export interface NoteDraftState {
  familyId: string;
  draft: string;
  touched: boolean;
}

export interface NoteStore {
  getNote(familyId: string): string | null;
  setNote(familyId: string, note: string): void;
}

export function idleNoteDraft(familyId: string): NoteDraftState {
  return { familyId, draft: "", touched: false };
}

/** Saved text stays visible until the user edits. An empty draft stays empty. */
export function noteFieldValue(
  session: NoteDraftState,
  savedNote: string | null,
  familyId: string,
): string {
  if (session.touched && session.familyId === familyId) return session.draft;
  return savedNote ?? "";
}

export function editNoteDraft(familyId: string, nextDraft: string): NoteDraftState {
  return { familyId, draft: nextDraft, touched: true };
}

function noteToCommit(session: NoteDraftState, savedNote: string | null, familyId: string): string | null {
  if (!session.touched || session.familyId !== familyId) return null;
  if (session.draft === (savedNote ?? "")) return null;
  return session.draft;
}

/** Focus then blur, with no edit, must not write. */
export function commitNoteOnBlur(
  session: NoteDraftState,
  familyId: string,
  store: NoteStore,
): NoteDraftState {
  const commit = noteToCommit(session, store.getNote(familyId), familyId);
  if (commit === null) return session;
  store.setNote(familyId, commit);
  return idleNoteDraft(familyId);
}

/** Leaving a model saves only that model's dirty draft, then loads the next note. */
export function switchNoteFamily(
  session: NoteDraftState,
  nextFamilyId: string,
  store: NoteStore,
): NoteDraftState {
  if (session.familyId === nextFamilyId) return session;
  const commit = noteToCommit(
    session,
    session.familyId ? store.getNote(session.familyId) : null,
    session.familyId,
  );
  if (commit !== null) store.setNote(session.familyId, commit);
  return idleNoteDraft(nextFamilyId);
}
