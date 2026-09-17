export interface ModelFamilyResearchState {
  modelFamilyId: string;
  ownerUserId: string;
  reviewedAt: string | null;
  savedAt: string | null;
  note: string | null;
}

export interface ResearchStateStoreV1 {
  version: 1;
  states: Record<string, Omit<ModelFamilyResearchState, "ownerUserId">>;
  updatedAt: string;
}

export interface ResearchStateStore {
  version: 2;
  records: Record<string, ModelFamilyResearchState>;
  updatedAt: string;
}

export function emptyResearchState(
  modelFamilyId: string,
  ownerUserId = "",
): ModelFamilyResearchState {
  return {
    modelFamilyId,
    ownerUserId,
    reviewedAt: null,
    savedAt: null,
    note: null,
  };
}
