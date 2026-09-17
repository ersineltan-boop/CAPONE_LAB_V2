import {
  OWNER_USER,
  findLocalUser,
  type AppSession,
  type AppUser,
} from "./roles";

export const SESSION_STORAGE_KEY = "capone-lab-v2-local-session-v1";

let currentUser: AppUser = loadPersistedUser() ?? OWNER_USER;
const listeners = new Set<() => void>();

function loadPersistedUser(): AppUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string };
    if (!parsed.userId) return null;
    return findLocalUser(parsed.userId) ?? null;
  } catch {
    return null;
  }
}

function persist(user: AppUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ userId: user.id }));
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function getSession(): AppSession {
  return { user: currentUser };
}

export function setSessionUserId(userId: string): AppSession {
  currentUser = findLocalUser(userId) ?? OWNER_USER;
  persist(currentUser);
  notify();
  return getSession();
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only: restore Owner and drop persisted session. */
export function resetSessionForTests(userId: string = OWNER_USER.id): AppSession {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
  currentUser = findLocalUser(userId) ?? OWNER_USER;
  notify();
  return getSession();
}
