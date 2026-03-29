"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      setErrorMsg(data.error ?? "Ошибка. Попробуйте ещё раз.");
      setStatus("error");
    } else {
      setStatus("sent");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 bg-lime-400 rounded-lg flex items-center justify-center">
          <span className="text-black font-bold text-lg">⚡</span>
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-none">Morrow Lab</p>
          <p className="text-white/40 text-xs">SMM Admin</p>
        </div>
      </div>

      <div className="w-full max-w-sm bg-surface-2 border border-border rounded-2xl p-6">
        {status === "sent" ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-lime-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📬</span>
            </div>
            <h2 className="text-white font-semibold text-lg mb-2">Проверьте почту</h2>
            <p className="text-muted text-sm leading-relaxed mb-6">
              Мы отправили письмо на <strong className="text-white">{email}</strong>.
              Нажмите на ссылку в письме для входа в систему.
            </p>
            <p className="text-muted/60 text-xs">
              Письмо может прийти в течение 1–2 минут. Проверьте папку «Спам».
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <h1 className="text-white text-xl font-semibold">Получить доступ</h1>
              <p className="text-muted text-sm mt-1">
                Для блогеров и партнёров Morrow Lab
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setStatus("idle"); }}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className="w-full bg-surface-4 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30 transition-colors"
                />
              </div>

              {status === "error" && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-3 py-2.5 leading-relaxed">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-lime-500 hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-lg py-2.5 text-sm transition-colors"
              >
                {loading ? "Отправляем…" : "Получить ссылку для входа"}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-border">
              <div className="bg-surface-4 rounded-xl p-3.5 text-xs text-white/40 leading-relaxed">
                <p className="font-semibold text-white/50 mb-1">Как получить доступ?</p>
                <p>
                  Доступ открывается автоматически после покупки пакета на{" "}
                  <a href="https://morrowlab.by" target="_blank" rel="noopener" className="text-lime-400 hover:underline">morrowlab.by</a>.
                  Используйте email, указанный при оплате.
                </p>
                <p className="mt-1.5">
                  Партнёры и блогеры — обратитесь к вашему менеджеру для получения приглашения.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <p className="mt-6 text-muted/60 text-xs">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-muted hover:text-white transition-colors">
          Войти
        </Link>
      </p>
    </div>
  );
}
