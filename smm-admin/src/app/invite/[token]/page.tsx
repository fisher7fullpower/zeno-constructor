"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Zap, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface InviteInfo {
  valid: boolean;
  client_name?: string;
  email?: string;
  role?: string;
  expired?: boolean;
  used?: boolean;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then((r) => r.json())
      .then((data: InviteInfo) => {
        setInvite(data);
        setLoadingInvite(false);
      })
      .catch(() => {
        setInvite({ valid: false });
        setLoadingInvite(false);
      });
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setError("Пароли не совпадают");
      return;
    }
    if (password.length < 8) {
      setError("Пароль минимум 8 символов");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/invites/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const { error: msg } = await res.json();
      setError(msg ?? "Ошибка принятия приглашения");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/"), 2000);
  }

  if (loadingInvite) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="w-10 h-10 bg-lime-500 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="text-white font-semibold text-lg leading-tight">Morrow Lab</div>
            <div className="text-muted text-xs">SMM Admin</div>
          </div>
        </div>

        {/* Invalid / expired */}
        {!invite?.valid && (
          <div className="bg-surface-2 border border-border rounded-xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-white font-medium mb-1">Приглашение недействительно</p>
            <p className="text-muted text-sm">
              {invite?.expired
                ? "Срок приглашения истёк. Запросите новое у владельца."
                : invite?.used
                ? "Это приглашение уже было использовано."
                : "Ссылка не найдена или повреждена."}
            </p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="bg-surface-2 border border-lime-500/20 rounded-xl p-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-lime-400 mx-auto mb-3" />
            <p className="text-white font-medium mb-1">Аккаунт создан!</p>
            <p className="text-muted text-sm">Входим в систему…</p>
          </div>
        )}

        {/* Accept form */}
        {invite?.valid && !success && (
          <div className="bg-surface-2 border border-border rounded-xl p-6">
            <h1 className="text-white text-xl font-semibold mb-1">Принять приглашение</h1>
            <p className="text-muted text-sm mb-1">
              Вас приглашают в{" "}
              <span className="text-white font-medium">{invite.client_name}</span>
            </p>
            <p className="text-muted text-xs mb-6">
              Email: <span className="text-white">{invite.email}</span> ·{" "}
              Роль: <span className="text-white capitalize">{invite.role}</span>
            </p>

            <form onSubmit={handleAccept} className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1.5">
                  Придумайте пароль
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 8 символов"
                  required
                  minLength={8}
                  className="w-full bg-surface-4 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1.5">
                  Повторите пароль
                </label>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-surface-4 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30 transition-colors"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-3 py-2.5">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                {loading ? "Создаём аккаунт…" : "Принять приглашение"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
