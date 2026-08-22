import { useCallback, useEffect, useState } from "react";

import {
  getResearchStateRepository,
  type ResearchStateRepository,
} from "./researchStateRepository";
import type { ModelFamilyResearchState } from "./types";

export function useResearchState(modelFamilyId: string): {
  state: ModelFamilyResearchState;
  setReviewed: (reviewed: boolean) => void;
  setSaved: (saved: boolean) => void;
  setNote: (note: string) => void;
} {
  const repo = getResearchStateRepository();
  const [state, setState] = useState(() => repo.get(modelFamilyId));

  useEffect(() => {
    setState(repo.get(modelFamilyId));
    return repo.subscribe(() => setState(repo.get(modelFamilyId)));
  }, [modelFamilyId, repo]);

  const setReviewed = useCallback(
    (reviewed: boolean) => setState(repo.setReviewed(modelFamilyId, reviewed)),
    [modelFamilyId, repo],
  );
  const setSaved = useCallback(
    (saved: boolean) => setState(repo.setSaved(modelFamilyId, saved)),
    [modelFamilyId, repo],
  );
  const setNote = useCallback(
    (note: string) => setState(repo.setNote(modelFamilyId, note)),
    [modelFamilyId, repo],
  );

  return { state, setReviewed, setSaved, setNote };
}

export function useResearchStateMap(): Map<string, ModelFamilyResearchState> {
  const repo = getResearchStateRepository();
  const [map, setMap] = useState(() => repo.getAll());

  useEffect(() => {
    setMap(repo.getAll());
    return repo.subscribe(() => setMap(repo.getAll()));
  }, [repo]);

  return map;
}

export function useResearchStateRepository(): ResearchStateRepository {
  return getResearchStateRepository();
}
