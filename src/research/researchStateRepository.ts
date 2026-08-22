import {
  emptyResearchState,
  type ModelFamilyResearchState,
  type ResearchStateStore,
} from "./types";

export interface ResearchStateRepository {
  get(modelFamilyId: string): ModelFamilyResearchState;
  getAll(): Map<string, ModelFamilyResearchState>;
  setReviewed(modelFamilyId: string, reviewed: boolean): ModelFamilyResearchState;
  setSaved(modelFamilyId: string, saved: boolean): ModelFamilyResearchState;
  setNote(modelFamilyId: string, note: string): ModelFamilyResearchState;
  subscribe(listener: () => void): () => void;
}

const STORAGE_KEY = "capone-lab-v2-research-state-v1";

function loadStore(): ResearchStateStore {
  if (typeof window === "undefined") {
    return { version: 1, states: {}, updatedAt: new Date().toISOString() };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { version: 1, states: {}, updatedAt: new Date().toISOString() };
    }
    return JSON.parse(raw) as ResearchStateStore;
  } catch {
    return { version: 1, states: {}, updatedAt: new Date().toISOString() };
  }
}

function saveStore(store: ResearchStateStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
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

  get(modelFamilyId: string): ModelFamilyResearchState {
    return this.store.states[modelFamilyId] ?? emptyResearchState(modelFamilyId);
  }

  getAll(): Map<string, ModelFamilyResearchState> {
    return new Map(Object.entries(this.store.states));
  }

  setReviewed(modelFamilyId: string, reviewed: boolean): ModelFamilyResearchState {
    const current = this.get(modelFamilyId);
    const next: ModelFamilyResearchState = {
      ...current,
      reviewedAt: reviewed ? new Date().toISOString() : null,
    };
    this.store.states[modelFamilyId] = next;
    this.persist();
    return next;
  }

  setSaved(modelFamilyId: string, saved: boolean): ModelFamilyResearchState {
    const current = this.get(modelFamilyId);
    const next: ModelFamilyResearchState = {
      ...current,
      savedAt: saved ? new Date().toISOString() : null,
    };
    this.store.states[modelFamilyId] = next;
    this.persist();
    return next;
  }

  setNote(modelFamilyId: string, note: string): ModelFamilyResearchState {
    const current = this.get(modelFamilyId);
    const next: ModelFamilyResearchState = {
      ...current,
      note: note.trim() ? note.trim() : null,
    };
    this.store.states[modelFamilyId] = next;
    this.persist();
    return next;
  }
}

let singleton: ResearchStateRepository | null = null;

export function getResearchStateRepository(): ResearchStateRepository {
  if (!singleton) {
    singleton = new LocalResearchStateRepository();
  }
  return singleton;
}

/** Test-only: reset singleton and optionally seed store. */
export function resetResearchStateRepositoryForTests(
  seed?: Record<string, ModelFamilyResearchState>,
): void {
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
