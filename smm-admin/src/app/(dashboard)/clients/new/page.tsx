"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";

const TIMEZONES = [
  "Europe/Minsk",
  "Europe/Moscow",
  "Europe/Kiev",
  "Europe/Warsaw",
  "Europe/Berlin",
];

export default function NewClientPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("Europe/Minsk");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(val: string) {
    setName(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .slice(0, 32)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, timezone }),
    });

    if (!res.ok) {
      const { error: msg } = await res.json();
      setError(msg ?? "Ошибка создания клиента");
      setLoading(false);
      return;
    }

    const { slug: newSlug } = await res.json();
    router.push(`/${newSlug}`);
  }

  return (
    <div className="p-6 max-w-lg">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад к клиентам
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-lime-500/20 rounded-lg flex items-center justify-center">
          <Building2 className="w-5 h-5 text-lime-400" />
        </div>
        <div>
          <h1 className="text-white text-xl font-semibold">Новый клиент</h1>
          <p className="text-muted text-sm">Создание рабочего пространства</p>
        </div>
      </div>

      <div className="bg-surface-2 border border-border rounded-xl p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-1.5">
              Название клиента / бизнеса
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Morrow Lab"
              required
              maxLength={64}
              className="w-full bg-surface-4 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1.5">
              URL-идентификатор (slug)
            </label>
            <div className="flex items-center gap-0 bg-surface-4 border border-border rounded-lg overflow-hidden focus-within:border-lime-500 focus-within:ring-1 focus-within:ring-lime-500/30 transition-colors">
              <span className="text-muted text-sm px-3 py-2.5 bg-surface-5 border-r border-border shrink-0">
                smm.morrowlab.by/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="client-name"
                required
                maxLength={32}
                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none"
              />
            </div>
            <p className="text-muted text-xs mt-1">Только латиница, цифры и дефис</p>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1.5">Часовой пояс</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-surface-4 border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30 transition-colors"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Link
              href="/clients"
              className="flex-1 text-center bg-surface-4 hover:bg-surface-5 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              Отмена
            </Link>
            <button
              type="submit"
              disabled={loading || !name || !slug}
              className="flex-1 bg-lime-500 hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              {loading ? "Создаём…" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
