"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus, Copy, Check, Trash2, Loader2, Clock } from "lucide-react";

interface Invite {
  id: string;
  email: string;
  role: string;
  used: boolean;
  expires_at: string;
  token: string;
}

const ROLES = [
  { value: "operator", label: "Оператор", desc: "Может создавать и публиковать" },
  { value: "client", label: "Клиент", desc: "Только просмотр" },
];

export default function TeamPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("client");
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadInvites() {
    setLoadingList(true);
    const res = await fetch(`/api/invites?workspace=${workspace}`);
    if (res.ok) {
      const data = await res.json();
      setInvites(data.invites ?? []);
    }
    setLoadingList(false);
  }

  useEffect(() => {
    loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNewLink(null);

    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace, email, role }),
    });

    if (!res.ok) {
      const { error: msg } = await res.json();
      setError(msg ?? "Ошибка создания приглашения");
      setLoading(false);
      return;
    }

    const { link } = await res.json();
    setNewLink(link);
    setEmail("");
    setLoading(false);
    loadInvites();
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://smm.morrowlab.by";

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <Link
        href={`/${workspace}/settings`}
        className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Настройки
      </Link>

      <div>
        <h1 className="text-white text-2xl font-semibold">Команда</h1>
        <p className="text-muted text-sm mt-0.5">Приглашение участников</p>
      </div>

      {/* Invite form */}
      <div className="bg-surface-2 border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-white font-medium text-sm flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-white/40" />
          Пригласить участника
        </h2>

        <form onSubmit={handleInvite} className="space-y-3">
          <div>
            <label className="block text-white/70 text-xs mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              required
              className="w-full bg-surface-4 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30 transition-colors"
            />
          </div>

          <div>
            <label className="block text-white/70 text-xs mb-1.5">Роль</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    role === r.value
                      ? "border-lime-500/40 bg-lime-500/10"
                      : "border-border hover:border-surface-5"
                  }`}
                >
                  <p className={`text-xs font-medium ${role === r.value ? "text-lime-400" : "text-white"}`}>
                    {r.label}
                  </p>
                  <p className="text-muted text-[10px] mt-0.5">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full flex items-center justify-center gap-2 bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Создать ссылку
          </button>
        </form>

        {/* New invite link */}
        {newLink && (
          <div className="bg-lime-500/10 border border-lime-500/20 rounded-xl p-4 space-y-2">
            <p className="text-lime-400 text-xs font-medium">Ссылка создана — отправь пользователю:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-white text-xs bg-surface-4 rounded-lg px-3 py-2 break-all">
                {newLink}
              </code>
              <button
                onClick={() => copyLink(newLink)}
                className="shrink-0 p-2 rounded-lg bg-lime-500 hover:bg-lime-400 text-black transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-muted text-[10px]">Ссылка действительна 7 дней</p>
          </div>
        )}
      </div>

      {/* Invites list */}
      <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-white font-medium text-sm">Отправленные приглашения</h2>
        </div>

        {loadingList ? (
          <div className="p-6 flex items-center gap-2 text-white/40">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загрузка…
          </div>
        ) : invites.length === 0 ? (
          <div className="p-6 text-center text-white/40 text-sm">
            Нет приглашений
          </div>
        ) : (
          <div className="divide-y divide-border">
            {invites.map((inv) => {
              const expired = new Date(inv.expires_at) < new Date();
              const link = `${appUrl}/invite/${inv.token}`;

              return (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{inv.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-muted text-xs capitalize">{inv.role}</span>
                      {inv.used ? (
                        <span className="badge-published">Принято</span>
                      ) : expired ? (
                        <span className="badge-failed">Истекло</span>
                      ) : (
                        <span className="badge-pending flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          Ожидает
                        </span>
                      )}
                    </div>
                  </div>

                  {!inv.used && !expired && (
                    <button
                      onClick={() => copyLink(link)}
                      className="p-1.5 text-white/40 hover:text-white transition-colors"
                      title="Копировать ссылку"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    className="p-1.5 text-white/40 hover:text-red-400 transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
