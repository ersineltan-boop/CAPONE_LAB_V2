import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  isNewTeamPassword,
  normalizeTeamUsername,
  teamLoginAddress,
} from "../../supabase/functions/_shared/teamCredentials";
import { createTeamReauthenticationClient, isTeamRole, teamClient } from "./teamClient";
import type { NewTeamMemberRequest, TeamMember } from "./teamClient";

interface TeamAccount {
  configured: boolean;
  loading: boolean;
  signedIn: boolean;
  member: TeamMember | null;
  error: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  createMember: (request: NewTeamMemberRequest) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

interface MembershipResult {
  userId: string;
  member: TeamMember | null;
  error: string | null;
}

const TeamAccountContext = createContext<TeamAccount | null>(null);

export function useTeamAccount(): TeamAccount {
  const account = useContext(TeamAccountContext);
  if (!account) throw new Error("TeamAccountProvider is missing");
  return account;
}

async function signIn(value: string, password: string): Promise<void> {
  const username = normalizeTeamUsername(value);
  const message = "Giriş yapılamadı. Kullanıcı adını ve şifreni kontrol et.";
  if (!teamClient || !username || !password) throw new Error(message);
  try {
    const { error } = await teamClient.auth.signInWithPassword({
      email: teamLoginAddress(username),
      password,
    });
    if (!error) return;
  } catch {
    // Keep account and provider details out of sign-in feedback.
  }
  throw new Error(message);
}

async function signOut(): Promise<void> {
  if (!teamClient) return;
  const { error } = await teamClient.auth.signOut({ scope: "local" });
  if (error) throw new Error("Oturum kapatılamadı. Yeniden dene.");
}

async function getCurrentSession(member: TeamMember) {
  if (!teamClient) throw new Error("Ekip oturumu bulunamadı.");
  const { data, error } = await teamClient.auth.getSession();
  if (error || data.session?.user.id !== member.user_id) {
    throw new Error("Ekip oturumun değişti. Yeniden giriş yap.");
  }
  return data.session;
}

async function createMemberForOwner(
  member: TeamMember | null,
  request: NewTeamMemberRequest,
): Promise<void> {
  if (!teamClient || member?.role !== "owner") {
    throw new Error("Üye eklemek için yönetici hesabınla giriş yap.");
  }
  const session = await getCurrentSession(member);
  const { data, response } = await teamClient.functions.invoke<{ ok: boolean }>("capone-create-member", {
    body: request,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (data?.ok === true) return;
  switch (response?.status) {
    case 400:
      throw new Error("Üye bilgilerini ve başlangıç şifresini kontrol et.");
    case 401:
    case 403:
      throw new Error("Üye eklemek için yönetici hesabınla yeniden giriş yap.");
    case 409:
      throw new Error("Bu kullanıcı adı kullanılıyor. Başka bir ad seç.");
    default:
      throw new Error("Üye eklenemedi. Biraz sonra yeniden dene.");
  }
}

async function changeMemberPassword(
  member: TeamMember | null,
  currentPassword: string,
  password: string,
): Promise<void> {
  const client = createTeamReauthenticationClient();
  if (!client || !member) throw new Error("Ekip hesabına yeniden giriş yap.");
  if (!isNewTeamPassword(password) || currentPassword === password) {
    throw new Error("Mevcut şifrenden farklı ve en az 12 karakterli bir şifre seç.");
  }
  const session = await getCurrentSession(member);
  const email = session.user.email;
  if (!email) throw new Error("Bu hesabın şifresi değiştirilemedi.");
  const username = normalizeTeamUsername(email.split("@")[0] ?? "");
  if (!username || email !== teamLoginAddress(username)) {
    throw new Error("Bu hesabın şifresi değiştirilemedi.");
  }

  try {
    const reauthenticated = await client.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthenticated.error || reauthenticated.data.user?.id !== member.user_id) {
      throw new Error("Şifre değiştirilemedi. Mevcut şifreni kontrol et.");
    }
    await getCurrentSession(member);
    const { error } = await client.auth.updateUser({ password, current_password: currentPassword });
    if (error) throw new Error("Şifre değiştirilemedi. Farklı bir şifreyle yeniden dene.");
  } finally {
    await client.auth.signOut({ scope: "local" }).catch(() => {});
  }
}

export default function TeamAccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState({ ready: !teamClient, userId: null as string | null });
  const [membership, setMembership] = useState<MembershipResult | null>(null);
  const { ready, userId } = session;

  useEffect(() => {
    if (!teamClient) return;
    const { data } = teamClient.auth.onAuthStateChange((_event, currentSession) => {
      const nextUserId = currentSession?.user.id ?? null;
      setSession((current) => current.ready && current.userId === nextUserId
        ? current
        : { ready: true, userId: nextUserId });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const client = teamClient;
    const memberId = userId;
    if (!client || !memberId) {
      setMembership(null);
      return;
    }
    const controller = new AbortController();
    const rejectMembership = () => {
      if (!controller.signal.aborted) {
        setMembership({ userId: memberId, member: null, error: "Ekip hesabı doğrulanamadı. Yeniden giriş yapmayı dene." });
      }
    };
    const loadMembership = async () => {
      const { data, error } = await client
        .from("capone_team_members")
        .select("user_id, display_name, role")
        .eq("user_id", memberId)
        .abortSignal(controller.signal)
        .maybeSingle();
      if (controller.signal.aborted) return;
      if (error) {
        rejectMembership();
        return;
      }
      const member = data && data.user_id === memberId && isTeamRole(data.role) &&
        typeof data.display_name === "string" && data.display_name.trim()
        ? { user_id: data.user_id, display_name: data.display_name, role: data.role }
        : null;
      setMembership({
        userId: memberId,
        member,
        error: member ? null : "Bu hesaba CAPONE ekip erişimi verilmemiş.",
      });
    };
    void loadMembership().catch(rejectMembership);
    return () => controller.abort();
  }, [userId]);

  const current = userId && membership?.userId === userId ? membership : null;
  const member = current?.member ?? null;

  return (
    <TeamAccountContext.Provider value={{
      configured: Boolean(teamClient),
      loading: !ready || Boolean(userId && !current),
      signedIn: Boolean(userId),
      member,
      error: current?.error ?? null,
      signIn,
      signOut,
      createMember: (request) => createMemberForOwner(member, request),
      changePassword: (currentPassword, newPassword) =>
        changeMemberPassword(member, currentPassword, newPassword),
    }}>
      {children}
    </TeamAccountContext.Provider>
  );
}
