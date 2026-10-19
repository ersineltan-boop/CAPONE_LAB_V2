import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getResearchStateRepository,
  resetResearchStateRepositoryForTests,
  type ResearchStateRepository,
} from "../../../research/researchStateRepository";
import type { ModelFamilyResearchState } from "../../../research/types";
import {
  commitNoteOnBlur,
  editNoteDraft,
  idleNoteDraft,
  noteFieldValue,
  switchNoteFamily,
  type NoteStore,
} from "../noteEditing";

function seed(id: string, note: string | null): ModelFamilyResearchState {
  return { modelFamilyId: id, reviewedAt: null, savedAt: null, note };
}

function storeFrom(repo: ResearchStateRepository): NoteStore {
  return {
    getNote: (id) => repo.get(id).note,
    setNote: (id, note) => {
      repo.setNote(id, note);
    },
  };
}

describe("model detail note editing", () => {
  let repo: ResearchStateRepository;
  let store: NoteStore;

  beforeEach(() => {
    resetResearchStateRepositoryForTests({
      "family-a": seed("family-a", "Kayıtlı not"),
      "family-b": seed("family-b", "Diğer model notu"),
    });
    repo = getResearchStateRepository();
    store = storeFrom(repo);
  });

  it("shows the saved note when the field is opened", () => {
    expect(noteFieldValue(idleNoteDraft("family-a"), repo.get("family-a").note, "family-a")).toBe(
      "Kayıtlı not",
    );
  });

  it("saves an edit and shows it again after the field is reopened", () => {
    let session = editNoteDraft("family-a", "Güncel not");
    expect(noteFieldValue(session, repo.get("family-a").note, "family-a")).toBe("Güncel not");

    session = commitNoteOnBlur(session, "family-a", store);
    expect(repo.get("family-a").note).toBe("Güncel not");

    const reopened = idleNoteDraft("family-a");
    expect(noteFieldValue(reopened, repo.get("family-a").note, "family-a")).toBe("Güncel not");
  });

  it("keeps a fully cleared draft empty instead of restoring the saved note", () => {
    const cleared = editNoteDraft("family-a", "");
    expect(noteFieldValue(cleared, "Kayıtlı not", "family-a")).toBe("");

    const session = commitNoteOnBlur(cleared, "family-a", store);
    expect(repo.get("family-a").note).toBeNull();
    expect(noteFieldValue(session, repo.get("family-a").note, "family-a")).toBe("");
    expect(repo.get("family-b").note).toBe("Diğer model notu");
  });

  it("does not delete the saved note when the field is focused and left unchanged", () => {
    const setNote = vi.spyOn(store, "setNote");
    const session = idleNoteDraft("family-a");

    const next = commitNoteOnBlur(session, "family-a", store);

    expect(next).toBe(session);
    expect(setNote).not.toHaveBeenCalled();
    expect(repo.get("family-a").note).toBe("Kayıtlı not");
  });

  it("does not write when an edit is reverted to the saved text", () => {
    const setNote = vi.spyOn(store, "setNote");
    const session = editNoteDraft("family-a", "Kayıtlı not");

    commitNoteOnBlur(session, "family-a", store);

    expect(setNote).not.toHaveBeenCalled();
    expect(repo.get("family-a").note).toBe("Kayıtlı not");
  });

  it("saves the draft onto the model being left and shows the next model's own note", () => {
    const dirty = editNoteDraft("family-a", "A taslağı");

    const next = switchNoteFamily(dirty, "family-b", store);

    expect(repo.get("family-a").note).toBe("A taslağı");
    expect(repo.get("family-b").note).toBe("Diğer model notu");
    expect(noteFieldValue(next, repo.get("family-b").note, "family-b")).toBe("Diğer model notu");
    expect(noteFieldValue(dirty, repo.get("family-b").note, "family-b")).toBe("Diğer model notu");
  });

  it("does not clear either note when switching models without an edit", () => {
    const setNote = vi.spyOn(store, "setNote");

    const next = switchNoteFamily(idleNoteDraft("family-a"), "family-b", store);

    expect(setNote).not.toHaveBeenCalled();
    expect(repo.get("family-a").note).toBe("Kayıtlı not");
    expect(noteFieldValue(next, repo.get("family-b").note, "family-b")).toBe("Diğer model notu");
  });
});
