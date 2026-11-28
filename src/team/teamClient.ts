/// <reference types="vite/client" />

import { createClient } from "@supabase/supabase-js";

export const TEAM_ROLE_LABELS = {
  owner: "Sahip",
  partner: "Ortak",
  employee: "Çalışan",
} as const;

export type TeamRole = keyof typeof TEAM_ROLE_LABELS;
export type NewTeamMemberRole = Exclude<TeamRole, "owner">;

export interface NewTeamMemberRequest {
  username: string;
  displayName: string;
  role: NewTeamMemberRole;
  password: string;
}

export interface TeamMember {
  user_id: string;
  display_name: string;
  role: TeamRole;
}

export function isTeamRole(value: unknown): value is TeamRole {
  return typeof value === "string" && Object.hasOwn(TEAM_ROLE_LABELS, value);
}

const url = import.meta.env?.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

function hasSafeProjectUrl(value: string): boolean {
  try {
    const address = new URL(value);
    return !address.username && !address.password &&
      (address.protocol === "https:" ||
        (address.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(address.hostname)));
  } catch {
    return false;
  }
}

export const teamClient = typeof window !== "undefined" && url && hasSafeProjectUrl(url) &&
  publishableKey?.startsWith("sb_publishable_")
  ? createClient(url, publishableKey, { auth: { detectSessionInUrl: false } })
  : null;

export function createTeamReauthenticationClient() {
  if (!teamClient || !url || !publishableKey) return null;
  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: "capone-team-password-change",
    },
  });
}
