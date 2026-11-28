import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { useTeamAccount } from "./TeamAccountProvider";
import { teamClient } from "./teamClient";
import type { TeamRole } from "./teamClient";

export interface TeamNote {
  id: string;
  model_family_id: string;
  body: string;
  author_name: string;
  author_role: TeamRole;
  created_at: string;
}

type NotesByModel = ReadonlyMap<string, readonly TeamNote[]>;
type AddTeamNote = (modelFamilyId: string, body: string) => Promise<void>;

interface NotesResult {
  scope: string;
  version: number;
  notesByModel: NotesByModel;
  error: string | null;
}

export const TEAM_NOTE_MAX_LENGTH = 4000;
const MODEL_BATCH_SIZE = 24;
const NOTES_PAGE_SIZE = 100;
const LOAD_ERROR = "Ekip notları yüklenemedi.";
const EMPTY_NOTES: NotesByModel = new Map();
const listeners = new Set<() => void>();
let notesVersion = 0;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getNotesVersion() {
  return notesVersion;
}

async function getMemberAccessToken(memberId: string) {
  const { data, error } = await teamClient!.auth.getSession();
  if (error || data.session?.user.id !== memberId) {
    throw new Error("Ekip oturumun değişti. Yeniden giriş yap.");
  }
  return data.session.access_token;
}

export function useAddTeamNote(): AddTeamNote | null {
  const { member } = useTeamAccount();
  const memberId = member?.user_id;
  const addNote = useCallback(async (modelFamilyId: string, value: string) => {
    const client = teamClient;
    if (!client || !memberId) throw new Error("Ekip hesabına giriş yap.");
    const body = value.trim();
    if (!body || body.length > TEAM_NOTE_MAX_LENGTH) {
      throw new Error("Ekip notu 1 ile 4000 karakter arasında olmalı.");
    }

    const accessToken = await getMemberAccessToken(memberId);
    const { error } = await client
      .from("capone_team_notes")
      .insert({ model_family_id: modelFamilyId, body })
      .setHeader("Authorization", `Bearer ${accessToken}`);
    if (error) throw new Error("Ekip notu paylaşılamadı. Yeniden dene.");

    notesVersion += 1;
    listeners.forEach((listener) => listener());
  }, [memberId]);
  return teamClient && memberId ? addNote : null;
}

async function loadNotes(
  memberId: string,
  modelFamilyIds: string[],
  signal: AbortSignal,
): Promise<NotesByModel> {
  const accessToken = await getMemberAccessToken(memberId);
  const notesByModel = new Map<string, TeamNote[]>();

  for (let start = 0; start < modelFamilyIds.length; start += MODEL_BATCH_SIZE) {
    const ids = modelFamilyIds.slice(start, start + MODEL_BATCH_SIZE);
    let cursor: TeamNote | undefined;

    do {
      if (signal.aborted) return EMPTY_NOTES;
      const query = teamClient!
        .from("capone_team_notes")
        .select("id, model_family_id, body, author_name, author_role, created_at")
        .in("model_family_id", ids)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(NOTES_PAGE_SIZE)
        .setHeader("Authorization", `Bearer ${accessToken}`)
        .abortSignal(signal);
      if (cursor) {
        const { created_at, id } = cursor;
        query.or(`created_at.lt.${created_at},and(created_at.eq.${created_at},id.gt.${id})`);
      }

      const { data, error } = await query;
      if (error) throw new Error(LOAD_ERROR);
      const notes = data as TeamNote[];
      for (const note of notes) {
        const existing = notesByModel.get(note.model_family_id);
        if (existing) existing.push(note);
        else notesByModel.set(note.model_family_id, [note]);
      }
      cursor = notes.length === NOTES_PAGE_SIZE ? notes.at(-1) : undefined;
    } while (cursor);
  }

  return notesByModel;
}

export function useTeamNotes(modelFamilyIds: readonly string[]) {
  const { member } = useTeamAccount();
  const memberId = member?.user_id;
  const addTeamNote = useAddTeamNote();
  const version = useSyncExternalStore(subscribe, getNotesVersion, getNotesVersion);
  const [result, setResult] = useState<NotesResult | null>(null);
  const modelsKey = JSON.stringify([...new Set(modelFamilyIds)].sort());
  const scope = memberId && modelsKey !== "[]" ? `${memberId}:${modelsKey}` : null;

  useEffect(() => {
    if (!memberId || !scope) {
      setResult(null);
      return;
    }
    const controller = new AbortController();
    const ids: string[] = JSON.parse(modelsKey);
    void loadNotes(memberId, ids, controller.signal)
      .then((notesByModel) => {
        if (!controller.signal.aborted) setResult({ scope, version, notesByModel, error: null });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResult({ scope, version, notesByModel: EMPTY_NOTES, error: LOAD_ERROR });
        }
      });
    return () => controller.abort();
  }, [memberId, modelsKey, scope, version]);

  const current = result?.scope === scope ? result : null;
  const loading = Boolean(scope && current?.version !== version);

  async function addNote(modelFamilyId: string, body: string) {
    if (!addTeamNote) throw new Error("Ekip hesabına giriş yap.");
    await addTeamNote(modelFamilyId, body);
  }

  return {
    enabled: Boolean(addTeamNote),
    loading,
    error: loading ? null : current?.error ?? null,
    notesByModel: current?.notesByModel ?? EMPTY_NOTES,
    addNote,
  };
}
