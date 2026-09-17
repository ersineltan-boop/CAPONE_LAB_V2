export const USER_ROLES = ["Owner", "Partner", "Employee", "Producer"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface AppUser {
  id: string;
  displayName: string;
  role: UserRole;
}

export interface AppSession {
  user: AppUser;
}

export interface OwnedRecord {
  /** Canonical actor id required by persisted client records. */
  userId: string;
  /** Backwards-compatible ownership field used by existing filters. */
  ownerUserId: string;
  /** Immutable record creation timestamp. */
  createdAt: string;
}

/** Local demo users only — no passwords or credentials. */
export const LOCAL_USERS: readonly AppUser[] = [
  { id: "user-owner", displayName: "Owner", role: "Owner" },
  { id: "user-partner", displayName: "Partner", role: "Partner" },
  { id: "user-employee", displayName: "Employee", role: "Employee" },
  { id: "user-producer", displayName: "Producer", role: "Producer" },
];

export const OWNER_USER = LOCAL_USERS[0];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function findLocalUser(userId: string): AppUser | undefined {
  return LOCAL_USERS.find((user) => user.id === userId);
}

export function displayNameForUserId(userId: string): string {
  return findLocalUser(userId)?.displayName ?? userId;
}
