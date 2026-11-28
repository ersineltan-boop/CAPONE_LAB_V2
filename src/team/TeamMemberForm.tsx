import { useId, useState } from "react";
import type { FormEvent } from "react";
import {
  isNewTeamPassword,
  normalizeTeamUsername,
} from "../../supabase/functions/_shared/teamCredentials";
import type { NewTeamMemberRequest } from "./teamClient";

const fieldClass = "w-full border border-line bg-cream px-2 py-1.5 text-base sm:text-sm";

export default function TeamMemberForm({
  onCreate,
  onBack,
}: {
  onCreate: (request: NewTeamMemberRequest) => Promise<void>;
  onBack: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const roleId = useId();
  const usernameHintId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const username = normalizeTeamUsername(String(fields.get("username") ?? ""));
    const displayName = String(fields.get("display-name") ?? "").trim();
    const role = fields.get("role");
    const password = String(fields.get("initial-password") ?? "");
    (form.elements.namedItem("initial-password") as HTMLInputElement).value = "";
    if (!username || !displayName || (role !== "partner" && role !== "employee") || !isNewTeamPassword(password)) {
      setFeedback({ message: "Kullanıcı adı, ad soyad ve şifre kurallarını kontrol et.", isError: true });
      return;
    }

    setPending(true);
    setFeedback(null);
    try {
      await onCreate({ username, displayName, role, password });
      form.reset();
      setFeedback({ message: "Ekip üyesi eklendi.", isError: false });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : "Üye eklenemedi.",
        isError: true,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <label className="block space-y-1 text-xs font-medium">
        <span>Ad soyad</span>
        <input name="display-name" autoComplete="off" maxLength={120} required className={fieldClass} />
      </label>
      <label className="block space-y-1 text-xs font-medium">
        <span>Kullanıcı adı</span>
        <input
          name="username"
          aria-describedby={usernameHintId}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          minLength={3}
          maxLength={32}
          pattern="[A-Za-z][A-Za-z0-9_\\-]{2,31}"
          required
          className={fieldClass}
        />
      </label>
      <p id={usernameHintId} className="text-xs leading-snug text-ink-muted">
        Harfle başlasın. 3–32 karakter ve yalnızca İngilizce harf, rakam, tire veya alt çizgi kullan.
      </p>
      <div className="space-y-1">
        <label htmlFor={roleId} className="block text-xs font-medium">Rol</label>
        <select id={roleId} name="role" required className={fieldClass}>
          <option value="employee">Çalışan</option>
          <option value="partner">Ortak</option>
        </select>
      </div>
      <label className="block space-y-1 text-xs font-medium">
        <span>Başlangıç şifresi</span>
        <input
          name="initial-password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={72}
          required
          className={fieldClass}
        />
      </label>
      <p className="text-xs text-ink-muted">En az 12 karakter kullan.</p>
      <div className="flex flex-wrap gap-1">
        <button type="submit" disabled={pending} className="touch-target border border-ink bg-ink px-3 py-1.5 text-xs text-cream disabled:opacity-60">
          {pending ? "Ekleniyor…" : "Üyeyi ekle"}
        </button>
        <button type="button" onClick={onBack} disabled={pending} className="touch-target px-2 py-1.5 text-xs text-ink-muted underline-offset-4 hover:underline">
          Hesabıma dön
        </button>
      </div>
      {feedback && <p role={feedback.isError ? "alert" : "status"} className="text-xs">{feedback.message}</p>}
    </form>
  );
}
