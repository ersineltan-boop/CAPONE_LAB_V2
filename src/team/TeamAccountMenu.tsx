import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useTeamAccount } from "./TeamAccountProvider";
import TeamMemberForm from "./TeamMemberForm";
import { TEAM_ROLE_LABELS } from "./teamClient";

const menuButton = "touch-target px-2.5 py-1 text-xs font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline";
const fieldClass = "w-full border border-line bg-cream px-2 py-1.5 text-base sm:text-sm";
const submitClass = "touch-target border border-ink bg-ink px-3 py-1.5 text-xs text-cream disabled:opacity-60";

export default function TeamAccountMenu() {
  const { configured, member, signedIn } = useTeamAccount();
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  if (!configured) return null;

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className="relative" onKeyDown={(event) => {
      if (open && event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    }}>
      <button
        ref={triggerRef}
        type="button"
        aria-controls={panelId}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={menuButton}
      >
        {signedIn ? "Hesabım" : "Ekip girişi"}
      </button>
      {open && (
        <div
          id={panelId}
          className="mt-1 max-h-[65vh] w-72 max-w-[calc(100vw-2rem)] space-y-3 overflow-y-auto border border-line bg-cream p-4 text-sm shadow-md sm:absolute sm:right-0 sm:z-10"
        >
          <AccountPanel key={member?.user_id ?? (signedIn ? "signed-in" : "signed-out")} onClose={close} />
        </div>
      )}
    </div>
  );
}

function AccountPanel({ onClose }: { onClose: () => void }) {
  const account = useTeamAccount();
  const [view, setView] = useState<"account" | "member" | "password">("account");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>, fallback: string) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await action();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : fallback);
    } finally {
      setPending(false);
    }
  }

  if (account.loading) return <p role="status">Hesap kontrol ediliyor…</p>;

  if (!account.signedIn) {
    function submit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const form = event.currentTarget;
      const fields = new FormData(form);
      const username = String(fields.get("username") ?? "");
      const password = String(fields.get("password") ?? "");
      (form.elements.namedItem("password") as HTMLInputElement).value = "";
      void run(() => account.signIn(username, password), "Giriş yapılamadı.");
    }

    return (
      <form className="space-y-3" onSubmit={submit}>
        <label className="block space-y-1 text-xs font-medium">
          <span>Kullanıcı adı</span>
          <input
            name="username"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={32}
            className={fieldClass}
          />
        </label>
        <label className="block space-y-1 text-xs font-medium">
          <span>Şifre</span>
          <input name="password" type="password" autoComplete="current-password" className={fieldClass} required />
        </label>
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
        {error && <p role="alert" className="text-xs">{error}</p>}
      </form>
    );
  }

  if (view === "member" && account.member?.role === "owner") {
    return <TeamMemberForm onCreate={account.createMember} onBack={() => setView("account")} />;
  }

  if (view === "password" && account.member) {
    return <PasswordChangeForm onChangePassword={account.changePassword} onBack={() => setView("account")} />;
  }

  return (
    <>
      {account.member && (
        <p className="[overflow-wrap:anywhere]">
          <strong className="font-medium">{account.member.display_name}</strong>
          <span className="block text-xs text-ink-muted">{TEAM_ROLE_LABELS[account.member.role]}</span>
        </p>
      )}
      {account.error && <p role="alert" className="text-xs">{account.error}</p>}
      <div className="flex flex-wrap gap-1">
        {account.member?.role === "owner" && (
          <button type="button" onClick={() => setView("member")} disabled={pending} className={submitClass}>
            Üye ekle
          </button>
        )}
        {account.member && (
          <button type="button" onClick={() => setView("password")} disabled={pending} className={menuButton}>
            Şifreyi değiştir
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => void run(account.signOut, "Oturum kapatılamadı.")} className={menuButton}>
          Çıkış yap
        </button>
      </div>
      {error && <p role="alert" className="text-xs">{error}</p>}
    </>
  );
}

function PasswordChangeForm({
  onChangePassword,
  onBack,
}: {
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onBack: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const current = String(fields.get("current-password") ?? "");
    const next = String(fields.get("new-password") ?? "");
    const confirmation = String(fields.get("confirm-password") ?? "");
    form.reset();
    if (next !== confirmation) {
      setFeedback({ message: "Yeni şifreler eşleşmiyor.", isError: true });
      return;
    }
    setPending(true);
    setFeedback(null);
    try {
      await onChangePassword(current, next);
      setFeedback({ message: "Şifren güncellendi.", isError: false });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : "Şifre değiştirilemedi.",
        isError: true,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <label className="block space-y-1 text-xs font-medium">
        <span>Mevcut şifre</span>
        <input name="current-password" type="password" autoComplete="current-password" required className={fieldClass} />
      </label>
      <label className="block space-y-1 text-xs font-medium">
        <span>Yeni şifre</span>
        <input name="new-password" type="password" autoComplete="new-password" minLength={12} required className={fieldClass} />
      </label>
      <label className="block space-y-1 text-xs font-medium">
        <span>Yeni şifreyi tekrar yaz</span>
        <input name="confirm-password" type="password" autoComplete="new-password" minLength={12} required className={fieldClass} />
      </label>
      <div className="flex flex-wrap gap-1">
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? "Kaydediliyor…" : "Şifreyi kaydet"}
        </button>
        <button type="button" onClick={onBack} disabled={pending} className={menuButton}>Hesabıma dön</button>
      </div>
      {feedback && <p role={feedback.isError ? "alert" : "status"} className="text-xs">{feedback.message}</p>}
    </form>
  );
}
