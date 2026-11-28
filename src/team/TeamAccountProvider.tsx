import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { isTeamRole, teamClient } from "./teamClient";
import type { TeamMember } from "./teamClient";

interface TeamAccount {
  configured: boolean;
  loading: boolean;
  signedIn: boolean;
  member: TeamMember | null;
  error: string | null;
  sendLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
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

async function sendLink(value: string): Promise<void> {
  if (!teamClient) return;
  const email = value.trim();
  if (email.length === 0) throw new Error("E-posta adresini yaz.");
  const emailRedirectTo = new URL(window.location.pathname, window.location.origin).href;
  const { error } = await teamClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo },
  });
  if (error && error.code !== "otp_disabled" && error.code !== "user_not_found") {
    throw new Error("Giriş bağlantısı gönderilemedi. Biraz sonra yeniden dene.");
  }
}

async function signOut(): Promise<void> {
  if (!teamClient) return;
  const { error } = await teamClient.auth.signOut({ scope: "local" });
  if (error) throw new Error("Oturum kapatılamadı. Yeniden dene.");
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
        error: member ? null : "Bu hesap için bir CAPONE ekip daveti bulunamadı.",
      });
    };
    void loadMembership().catch(rejectMembership);
    return () => controller.abort();
  }, [userId]);

  const current = userId && membership?.userId === userId ? membership : null;

  return (
    <TeamAccountContext.Provider value={{
      configured: Boolean(teamClient),
      loading: !ready || Boolean(userId && !current),
      signedIn: Boolean(userId),
      member: current?.member ?? null,
      error: current?.error ?? null,
      sendLink,
      signOut,
    }}>
      {children}
    </TeamAccountContext.Provider>
  );
}
