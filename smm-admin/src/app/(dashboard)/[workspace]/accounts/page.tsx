"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Wifi,
  WifiOff,
  Plus,
  Loader2,
  ExternalLink,
  Trash2,
  RefreshCw,
} from "lucide-react";

interface Account {
  id: string;
  platform: string;
  name: string;
  username?: string;
  avatar?: string;
  connected: boolean;
}

const SUPPORTED_PLATFORMS = [
  {
    id: "instagram",
    label: "Instagram",
    description: "Reels, Stories, Posts",
    color: "from-purple-500 to-pink-500",
    icon: "IG",
  },
  {
    id: "tiktok",
    label: "TikTok",
    description: "Shorts, Videos",
    color: "from-gray-800 to-gray-600",
    icon: "TT",
  },
  {
    id: "vk",
    label: "ВКонтакте",
    description: "Посты, Клипы, Истории",
    color: "from-blue-600 to-blue-400",
    icon: "VK",
  },
  {
    id: "telegram",
    label: "Telegram",
    description: "Каналы",
    color: "from-sky-500 to-sky-400",
    icon: "TG",
  },
];

export default function AccountsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  async function loadAccounts() {
    setLoading(true);
    const res = await fetch(`/api/accounts?workspace=${workspace}`);
    if (res.ok) {
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  async function handleConnect(platform: string) {
    setConnecting(platform);
    const res = await fetch(
      `/api/accounts/connect?workspace=${workspace}&platform=${platform}`
    );
    if (res.ok) {
      const { url } = await res.json();
      if (url) {
        window.open(url, "_blank");
        // Reload accounts after user returns
        setTimeout(loadAccounts, 5000);
      }
    }
    setConnecting(null);
  }

  async function handleDisconnect(accountId: string) {
    setDisconnecting(accountId);
    await fetch(`/api/accounts/${accountId}?workspace=${workspace}`, {
      method: "DELETE",
    });
    await loadAccounts();
    setDisconnecting(null);
  }

  const connectedPlatforms = new Set(accounts.map((a) => a.platform));

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-semibold">Аккаунты</h1>
          <p className="text-muted text-sm mt-0.5">
            Подключённые социальные сети
          </p>
        </div>
        <button
          onClick={loadAccounts}
          disabled={loading}
          className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {/* Connected Accounts */}
      {accounts.length > 0 && (
        <div>
          <h2 className="text-white/60 text-xs uppercase tracking-wider mb-3">
            Подключены
          </h2>
          <div className="space-y-2">
            {accounts.map((acc) => {
              const platform = SUPPORTED_PLATFORMS.find(
                (p) => p.id === acc.platform
              );
              return (
                <div
                  key={acc.id}
                  className="flex items-center gap-4 bg-surface-2 border border-border rounded-xl p-4"
                >
                  {/* Avatar / Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${
                      platform?.color ?? "from-gray-500 to-gray-700"
                    } flex items-center justify-center shrink-0`}
                  >
                    {acc.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={acc.avatar}
                        alt={acc.name}
                        className="w-full h-full rounded-xl object-cover"
                      />
                    ) : (
                      <span className="text-white text-xs font-bold">
                        {platform?.icon ?? acc.platform.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{acc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Wifi className="w-3 h-3 text-lime-400" />
                      <span className="text-muted text-xs">
                        {platform?.label ?? acc.platform}
                        {acc.username ? ` · @${acc.username}` : ""}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDisconnect(acc.id)}
                    disabled={disconnecting === acc.id}
                    className="text-muted hover:text-red-400 transition-colors p-1"
                    title="Отключить"
                  >
                    {disconnecting === acc.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add new accounts */}
      <div>
        <h2 className="text-white/60 text-xs uppercase tracking-wider mb-3">
          Добавить аккаунт
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUPPORTED_PLATFORMS.map((platform) => {
            const isConnected = connectedPlatforms.has(platform.id);
            const isConnecting = connecting === platform.id;

            return (
              <div
                key={platform.id}
                className={`bg-surface-2 border rounded-xl p-4 flex items-center gap-4 ${
                  isConnected
                    ? "border-lime-500/20 opacity-70"
                    : "border-border hover:border-surface-5 transition-colors"
                }`}
              >
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${platform.color} flex items-center justify-center shrink-0`}
                >
                  <span className="text-white text-xs font-bold">
                    {platform.icon}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{platform.label}</p>
                  <p className="text-muted text-xs">{platform.description}</p>
                </div>

                {isConnected ? (
                  <div className="flex items-center gap-1 text-lime-400 text-xs">
                    <Wifi className="w-3.5 h-3.5" />
                    Подключён
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(platform.id)}
                    disabled={isConnecting}
                    className="flex items-center gap-1.5 bg-surface-4 hover:bg-surface-5 border border-border text-white text-xs font-medium rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Подключить
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Info block */}
      <div className="bg-surface-2 border border-border rounded-xl p-4">
        <div className="flex items-start gap-3">
          <ExternalLink className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
          <div>
            <p className="text-white text-sm font-medium mb-1">
              Как подключить аккаунт?
            </p>
            <p className="text-muted text-xs leading-relaxed">
              Нажми «Подключить» — выбери соцсеть и авторизуйся. После этого аккаунт
              появится в списке через несколько секунд.
            </p>
            <p className="text-muted text-xs mt-2 leading-relaxed">
              Для Instagram нужен <strong className="text-white/70">Business или Creator</strong> аккаунт,
              привязанный к Facebook Странице.
            </p>
          </div>
        </div>
      </div>

      {/* No accounts state */}
      {!loading && accounts.length === 0 && (
        <div className="bg-surface-2 border border-dashed border-border rounded-xl p-10 text-center">
          <WifiOff className="w-10 h-10 text-white/40 mx-auto mb-3" />
          <p className="text-white font-medium mb-1">Нет подключённых аккаунтов</p>
          <p className="text-muted text-sm">
            Подключи хотя бы один аккаунт чтобы начать публиковать
          </p>
        </div>
      )}
    </div>
  );
}
