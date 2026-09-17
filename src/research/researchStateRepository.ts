import { filterVisibleRecords } from "../auth/permissions";
import { OWNER_USER } from "../auth/roles";
import { getSession } from "../auth/session";
import {
  emptyResearchState,
  type ModelFamilyResearchState,
  type ResearchStateStore,
  type ResearchStateStoreV1,
} from "./types";

export interface ResearchStateRepository {
  get(modelFamilyId: string): ModelFamilyResearchState;
  getAll(): Map<string, ModelFamilyResearchState>;
  listVisible(): Map<string, ModelFamilyResearchState>;
  listAllRecords(): ModelFamilyResearchState[];
  setReviewed(modelFamilyId: string, reviewed: boolean): ModelFamilyResearchState;
  setSaved(modelFamilyId: string, saved: boolean): ModelFamilyResearchState;
  setNote(modelFamilyId: string, note: string): ModelFamilyResearchState;
  subscribe(listener: () => void): () => void;
}

const STORAGE_KEY = "capone-lab-v2-research-state-v1";

function recordKey(ownerUserId: string, modelFamilyId: string): string {
  return `${ownerUserId}::${modelFamilyId}`;
}

function currentUserId(): string {
  return getSession().user.id;
}

function emptyStore(): ResearchStateStore {
  return { version: 2, records: {}, updatedAt: new Date().toISOString() };
}

function migrateStore(raw: unknown): ResearchStateStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const data = raw as Partial<ResearchStateStore> & Partial<ResearchStateStoreV1>;
  if (data.version === 2 && data.records) {
    return {
      version: 2,
      records: data.records,
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    };
  }
  if (data.version === 1 && data.states) {
    const records: Record<string, ModelFamilyResearchState> = {};
    for (const [modelFamilyId, state] of Object.entries(data.states)) {
      const next: ModelFamilyResearchState = {
        ...state,
        ownerUserId: OWNER_USER.id,
      };
      records[recordKey(OWNER_USER.id, modelFamilyId)] = next;
    }
    return { version: 2, records, updatedAt: data.updatedAt ?? new Date().toISOString() };
  }
  return emptyStore();
}

function loadStore(): ResearchStateStore {
  if (typeof window === "undefined") {
    return emptyStore();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    return migrateStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

function saveStore(store: ResearchStateStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function mapByFamily(records: ModelFamilyResearchState[]): Map<string, ModelFamilyResearchState> {
  const map = new Map<string, ModelFamilyResearchState>();
  const viewerId = currentUserId();
  for (const record of records) {
    const existing = map.get(record.modelFamilyId);
    if (!existing || record.ownerUserId === viewerId) {
      map.set(record.modelFamilyId, record);
    }
  }
  return map;
}

export class LocalResearchStateRepository implements ResearchStateRepository {
  private store: ResearchStateStore;
  private listeners = new Set<() => void>();

  constructor() {
    this.store = loadStore();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private persist(): void {
    this.store.updatedAt = new Date().toISOString();
    saveStore(this.store);
    this.notify();
  }

  private ownRecord(modelFamilyId: string): ModelFamilyResearchState | undefined {
    return this.store.records[recordKey(currentUserId(), modelFamilyId)];
  }

  get(modelFamilyId: string): ModelFamilyResearchState {
    return this.ownRecord(modelFamilyId) ?? emptyResearchState(modelFamilyId, currentUserId());
  }

  getAll(): Map<string, ModelFamilyResearchState> {
    const own = Object.values(this.store.records).filter(
      (record) => record.ownerUserId === currentUserId(),
    );
    return mapByFamily(own);
  }

  listAllRecords(): ModelFamilyResearchState[] {
    return Object.values(this.store.records);
  }

  listVisible(): Map<string, ModelFamilyResearchState> {
    return mapByFamily(filterVisibleRecords(this.listAllRecords(), getSession().user));
  }

  private write(
    modelFamilyId: string,
    patch: Partial<ModelFamilyResearchState>,
  ): ModelFamilyResearchState {
    const ownerUserId = currentUserId();
    const current = this.get(modelFamilyId);
    const next: ModelFamilyResearchState = {
      ...current,
      ...patch,
      modelFamilyId,
      ownerUserId,
    };
    this.store.records[recordKey(ownerUserId, modelFamilyId)] = next;
    this.persist();
    return next;
  }

  setReviewed(modelFamilyId: string, reviewed: boolean): ModelFamilyResearchState {
    return this.write(modelFamilyId, {
      reviewedAt: reviewed ? new Date().toISOString() : null,
    });
  }

  setSaved(modelFamilyId: string, saved: boolean): ModelFamilyResearchState {
    return this.write(modelFamilyId, {
      savedAt: saved ? new Date().toISOString() : null,
    });
  }

  setNote(modelFamilyId: string, note: string): ModelFamilyResearchState {
    return this.write(modelFamilyId, {
      note: note.trim() ? note.trim() : null,
    });
  }
}

let singleton: ResearchStateRepository | null = null;

export function getResearchStateRepository(): ResearchStateRepository {
  if (!singleton) {
    singleton = new LocalResearchStateRepository();
  }
  return singleton;
}

/** Test-only: reset singleton and optionally seed store for the current user. */
export function resetResearchStateRepositoryForTests(
  seed?: Record<string, ModelFamilyResearchState>,
): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  singleton = new LocalResearchStateRepository();
  if (seed) {
    for (const [id, state] of Object.entries(seed)) {
      singleton.setReviewed(id, Boolean(state.reviewedAt));
      if (state.savedAt) singleton.setSaved(id, true);
      if (state.note) singleton.setNote(id, state.note);
    }
  }
}

export function isReviewed(state: ModelFamilyResearchState): boolean {
  return Boolean(state.reviewedAt);
}

export function isSaved(state: ModelFamilyResearchState): boolean {
  return Boolean(state.savedAt);
}
