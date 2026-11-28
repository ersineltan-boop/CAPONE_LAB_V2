import { useId, useState } from "react";
import { useTeamAccount } from "./TeamAccountProvider";
import { TEAM_ROLE_LABELS } from "./teamClient";

const menuButton = "touch-target px-2.5 py-1 text-[10px] font-medium text-ink-muted underline-offset-4 hover:underline";

export default function TeamAccountMenu() {
  const account = useTeamAccount();
  const panelId = useId();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);

  if (!account.configured) return null;

  async function signOut() {
    setPending(true);
    setFeedback(null);
    try {
      await account.signOut();
      setEmail("");
      setOpen(false);
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "Oturum kapatılamadı.", error: true });
    } finally {
      setPending(false);
    }
  }

  async function requestLink() {
    setPending(true);
    setFeedback(null);
    try {
      await account.sendLink(email);
      setFeedback({ message: "Davetli bir hesabın varsa giriş bağlantısı e-posta adresine gönderilir.", error: false });
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "Bağlantı gönderilemedi.", error: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-controls={panelId}
        aria-expanded={open}
        onClick={() => {
          setFeedback(null);
          setOpen(!open);
        }}
        className={menuButton}
      >
        {account.member ? "Hesabım" : "Ekip girişi"}
      </button>
      {open && (
        <div
          id={panelId}
          className="mt-1 w-64 max-w-[calc(100vw-2rem)] space-y-3 border border-line bg-cream p-3 text-sm shadow-md sm:absolute sm:right-0 sm:z-10"
        >
          {account.loading ? (
            <p role="status">Hesap kontrol ediliyor…</p>
          ) : account.signedIn ? (
            <>
              {account.member && (
                <p>
                  <strong className="font-medium">{account.member.display_name}</strong>
                  <span className="block text-xs text-ink-muted">{TEAM_ROLE_LABELS[account.member.role]}</span>
                </p>
              )}
              {account.error && <p role="alert" className="text-xs">{account.error}</p>}
              <button type="button" disabled={pending} onClick={signOut} className={menuButton}>
                Çıkış yap
              </button>
            </>
          ) : (
            <form className="space-y-2" onSubmit={(event) => {
              event.preventDefault();
              void requestLink();
            }}>
              <label htmlFor={inputId} className="block text-xs font-medium">Davetli e-posta adresi</label>
              <input
                id={inputId}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border border-line bg-cream px-2 py-1.5 text-sm"
              />
              <button type="submit" disabled={pending} className="touch-target border border-ink bg-ink px-2 py-1 text-xs text-cream disabled:opacity-60">
                {pending ? "Gönderiliyor…" : "Giriş bağlantısı gönder"}
              </button>
            </form>
          )}
          {feedback && <p role={feedback.error ? "alert" : "status"} className="text-xs">{feedback.message}</p>}
        </div>
      )}
    </div>
  );
}
