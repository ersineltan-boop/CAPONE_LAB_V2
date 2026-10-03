import { useCallback, useEffect, useState } from "react";

import { subscribeSession } from "../auth/session";
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
    const sync = () => setState(repo.get(modelFamilyId));
    sync();
    const unsubRepo = repo.subscribe(sync);
    const unsubSession = subscribeSession(sync);
    return () => {
      unsubRepo();
      unsubSession();
    };
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
    const sync = () => setMap(repo.getAll());
    sync();
    const unsubRepo = repo.subscribe(sync);
    const unsubSession = subscribeSession(sync);
    return () => {
      unsubRepo();
      unsubSession();
    };
  }, [repo]);

  return map;
}

export function useVisibleResearchStateMap(): Map<string, ModelFamilyResearchState> {
  const repo = getResearchStateRepository();
  const [map, setMap] = useState(() => repo.listVisible());

  useEffect(() => {
    const sync = () => setMap(repo.listVisible());
    sync();
    const unsubRepo = repo.subscribe(sync);
    const unsubSession = subscribeSession(sync);
    return () => {
      unsubRepo();
      unsubSession();
    };
  }, [repo]);

  return map;
}

export function useResearchStateRepository(): ResearchStateRepository {
  return getResearchStateRepository();
}
