export interface ModelFamilyResearchState {
  modelFamilyId: string;
  userId: string;
  ownerUserId: string;
  createdAt: string;
  reviewedAt: string | null;
  savedAt: string | null;
  note: string | null;
}

export interface ResearchStateStoreV1 {
  version: 1;
  states: Record<
    string,
    Omit<ModelFamilyResearchState, "userId" | "ownerUserId" | "createdAt">
  >;
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
    userId: ownerUserId,
    ownerUserId,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    savedAt: null,
    note: null,
  };
}
