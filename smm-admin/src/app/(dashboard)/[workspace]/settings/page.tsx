"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Save, Loader2, Clock, Bell, Users, ArrowRight } from "lucide-react";

interface ClientData {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  require_approval: boolean;
}

const TIMEZONES = [
  "Europe/Minsk",
  "Europe/Moscow",
  "Europe/Kiev",
  "Europe/Warsaw",
  "Europe/Berlin",
  "Asia/Almaty",
  "America/New_York",
];

export default function SettingsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const [client, setClient] = useState<ClientData | null>(null);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Europe/Minsk");
  const [requireApproval, setRequireApproval] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${workspace}`)
      .then((r) => r.json())
      .then((data) => {
        setClient(data);
        setName(data.name ?? "");
        setTimezone(data.timezone ?? "Europe/Minsk");
        setRequireApproval(data.require_approval ?? true);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [workspace]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    await fetch(`/api/clients/${workspace}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        timezone,
        require_approval: requireApproval,
      }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-white/40">
        <Loader2 className="w-4 h-4 animate-spin" />
        Загрузка…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-white text-2xl font-semibold">Настройки</h1>
        <p className="text-muted text-sm mt-0.5">{client?.name}</p>
      </div>

      {/* Basic info */}
      <div className="bg-surface-2 border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-white font-medium text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-white/40" />
          Основное
        </h2>

        <div>
          <label className="block text-white/70 text-xs mb-1.5">Название клиента</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-surface-4 border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30 transition-colors"
          />
        </div>

        <div>
          <label className="block text-white/70 text-xs mb-1.5">Часовой пояс</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full bg-surface-4 border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-lime-500 transition-colors"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Approval */}
      <div className="bg-surface-2 border border-border rounded-xl p-5">
        <h2 className="text-white font-medium text-sm flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-white/40" />
          Публикация
        </h2>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setRequireApproval(!requireApproval)}
            className={`relative w-10 h-6 rounded-full transition-colors ${
              requireApproval ? "bg-lime-500" : "bg-surface-5"
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                requireApproval ? "left-5" : "left-1"
              }`}
            />
          </div>
          <div>
            <p className="text-white text-sm">Требовать одобрения</p>
            <p className="text-muted text-xs">
              Посты уходят на проверку перед публикацией
            </p>
          </div>
        </label>
      </div>

      {/* Team */}
      <Link
        href={`/${workspace}/settings/team`}
        className="flex items-center gap-4 bg-surface-2 border border-border hover:border-surface-5 rounded-xl p-4 transition-colors group"
      >
        <div className="w-9 h-9 bg-surface-4 rounded-lg flex items-center justify-center shrink-0">
          <Users className="w-4 h-4 text-white/40" />
        </div>
        <div className="flex-1">
          <p className="text-white text-sm font-medium">Команда</p>
          <p className="text-muted text-xs">Пригласить клиентов и операторов</p>
        </div>
        <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
      </Link>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>

        {saved && (
          <span className="text-lime-400 text-sm">✓ Сохранено</span>
        )}
      </div>
    </div>
  );
}
