import { useState, type FormEvent, type ReactNode } from "react";
import { useTeamAccount } from "./TeamAccountProvider";

const fieldClass = "h-12 w-full border border-line bg-cream px-3 text-base text-ink transition-colors focus:border-ink focus:outline-none";
const submitClass = "min-h-12 w-full border border-ink bg-ink px-4 text-sm font-medium text-cream transition-colors hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-60";

export function TeamMemberEntry({ children }: { children: ReactNode }) {
  const account = useTeamAccount();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>, fallback: string) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : fallback);
    } finally {
      setPending(false);
    }
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const username = String(fields.get("username") ?? "");
    const passwordField = form.elements.namedItem("password");
    if (!(passwordField instanceof HTMLInputElement)) return;
    const password = passwordField.value;
    passwordField.value = "";
    void run(() => account.signIn(username, password), "Giriş yapılamadı.");
  }

  if (account.member) return children;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <div className="border border-line bg-white/40 px-6 py-8 sm:p-10">
        <div className="space-y-3">
          <p className="font-serif text-sm font-medium tracking-[0.16em]">CAPONE LAB</p>
          <h1 className="font-serif text-3xl font-medium tracking-wide sm:text-4xl">Üye girişi</h1>
        </div>

        <div className="mt-7 space-y-4">
          {!account.configured ? (
            <p role="status" className="text-sm text-ink-muted">Üye girişi şu anda kullanılamıyor.</p>
          ) : account.loading ? (
            <p role="status" className="text-sm text-ink-muted">Oturum kontrol ediliyor…</p>
          ) : account.signedIn ? (
            <>
              <p role="alert" className="text-sm text-ink">
                {account.error ?? "Bu hesaba CAPONE LAB erişimi verilmemiş."}
              </p>
              <button
                type="button"
                disabled={pending}
                className={submitClass}
                onClick={() => void run(account.signOut, "Oturum kapatılamadı.")}
              >
                {pending ? "Oturum kapatılıyor…" : "Başka hesapla giriş yap"}
              </button>
            </>
          ) : (
            <form className="space-y-4" onSubmit={signIn}>
              <label className="block space-y-1.5 text-sm font-medium">
                <span className="block">Kullanıcı adı</span>
                <input
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={32}
                  required
                  className={fieldClass}
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">
                <span className="block">Şifre</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className={fieldClass}
                />
              </label>
              <button type="submit" disabled={pending} className={submitClass}>
                {pending ? "Giriş yapılıyor…" : "Giriş yap"}
              </button>
            </form>
          )}
          {error && <p role="alert" className="text-sm text-ink">{error}</p>}
        </div>
      </div>
    </main>
  );
}
