export interface ModelFamilyResearchState {
  modelFamilyId: string;
  reviewedAt: string | null;
  savedAt: string | null;
  note: string | null;
}

export interface ResearchStateStore {
  version: 1;
  states: Record<string, ModelFamilyResearchState>;
  updatedAt: string;
}

export function emptyResearchState(modelFamilyId: string): ModelFamilyResearchState {
  return {
    modelFamilyId,
    reviewedAt: null,
    savedAt: null,
    note: null,
  };
}
