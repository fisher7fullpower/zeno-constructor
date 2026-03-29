import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Plus,
  FileText,
  Filter,
  LayoutGrid,
  List,
  Sparkles,
} from "lucide-react";
import { statusLabel } from "@/lib/utils";

interface Props {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ status?: string; platform?: string; view?: string }>;
}

const STATUS_FILTERS = [
  { value: "", label: "Все" },
  { value: "published", label: "Опубликованы" },
  { value: "scheduled", label: "Запланированы" },
  { value: "draft", label: "Черновики" },
  { value: "failed", label: "Ошибки" },
];

const PLATFORM_FILTERS = [
  { value: "", label: "Все платформы" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "vk", label: "ВКонтакте" },
];

export default async function ContentPage({ params, searchParams }: Props) {
  const { workspace } = await params;
  const { status = "", platform = "", view = "list" } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", workspace)
    .single();

  if (!client) notFound();

  const { data: access } = await supabase
    .from("client_users")
    .select("role")
    .eq("client_id", client.id)
    .eq("user_id", user.id)
    .single();

  if (!access) redirect("/clients");

  const baseUrl = `/${workspace}/content`;

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-semibold">Контент</h1>
          <p className="text-muted text-sm mt-0.5">
            0 публикаций · {client.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${workspace}/content/new?ai=1`}
            className="flex items-center gap-2 border border-lime-500/40 hover:bg-lime-500/10 text-lime-400 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            AI-генерация
          </Link>
          <Link
            href={`/${workspace}/content/new`}
            className="flex items-center gap-2 bg-lime-500 hover:bg-lime-400 text-black font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Создать
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status filter */}
        <div className="flex items-center gap-1 bg-surface-2 border border-border rounded-lg p-1">
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f.value}
              href={`${baseUrl}?status=${f.value}&platform=${platform}&view=${view}`}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                status === f.value
                  ? "bg-lime-500 text-black"
                  : "text-muted hover:text-white"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {/* Platform filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-white/40" />
          <div className="flex items-center gap-1 bg-surface-2 border border-border rounded-lg p-1">
            {PLATFORM_FILTERS.map((f) => (
              <Link
                key={f.value}
                href={`${baseUrl}?status=${status}&platform=${f.value}&view=${view}`}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  platform === f.value
                    ? "bg-surface-4 text-white"
                    : "text-muted hover:text-white"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-surface-2 border border-border rounded-lg p-1 ml-auto">
          <Link
            href={`${baseUrl}?status=${status}&platform=${platform}&view=list`}
            className={`p-1.5 rounded-md transition-colors ${
              view !== "grid" ? "bg-surface-4 text-white" : "text-muted hover:text-white"
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={`${baseUrl}?status=${status}&platform=${platform}&view=grid`}
            className={`p-1.5 rounded-md transition-colors ${
              view === "grid" ? "bg-surface-4 text-white" : "text-muted hover:text-white"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Empty state */}
      <div className="bg-surface-2 border border-border rounded-xl p-12 text-center">
        <FileText className="w-10 h-10 text-white/40 mx-auto mb-3" />
        <p className="text-white font-medium mb-1">Нет публикаций</p>
        <p className="text-muted text-sm mb-4">
          {status ? `Нет постов со статусом "${statusLabel(status)}"` : "Создайте первую публикацию"}
        </p>
        <Link
          href={`/${workspace}/content/new`}
          className="inline-flex items-center gap-2 bg-lime-500 hover:bg-lime-400 text-black font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Создать пост
        </Link>
      </div>
    </div>
  );
}
