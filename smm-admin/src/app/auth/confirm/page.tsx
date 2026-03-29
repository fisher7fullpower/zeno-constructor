/**
 * Confirm page — receives token via query param, auto-POSTs it
 * to /api/auth/confirm to consume the magic link token.
 * This avoids CSRF issues with GET-based state changes.
 */
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Suspense } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: "Неверная или уже использованная ссылка.",
  expired_token: "Ссылка устарела. Запросите новую.",
  user_not_found: "Аккаунт не найден. Попробуйте зарегистрироваться.",
};

function ConfirmContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const errorParam = params.get("error");
  const [error, setError] = useState<string | null>(errorParam);

  useEffect(() => {
    if (!token || error) return;

    fetch("/api/auth/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "unknown");
          return;
        }
        const rd = data.redirect || "/clients";
        router.push(rd.startsWith("/") && !rd.startsWith("//") ? rd : "/clients");
      })
      .catch(() => {
        setError("unknown");
      });
  }, [token, error, router]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-surface-2 border border-border rounded-2xl p-6 text-center">
        {error ? (
          <>
            <h2 className="text-white font-semibold text-lg mb-2">Ссылка недействительна</h2>
            <p className="text-muted text-sm mb-6 leading-relaxed">
              {ERROR_MESSAGES[error] ?? "Произошла ошибка. Попробуйте ещё раз."}
            </p>
            <div className="flex gap-3">
              <Link
                href="/login"
                className="flex-1 bg-surface-4 hover:bg-surface-5 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="flex-1 bg-lime-500 hover:bg-lime-400 text-black rounded-lg py-2.5 text-sm font-bold transition-colors"
              >
                Регистрация
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-lime-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted text-sm">Входим...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  );
}
