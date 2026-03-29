import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  CalendarDays,
  Wifi,
  BarChart2,
  TrendingUp,
  FileText,
  CheckCircle2,
  Clock,
  Plus,
} from "lucide-react";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function WorkspacePage({ params }: Props) {
  const { workspace } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load client
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", workspace)
    .single();

  if (!client) notFound();

  // Check access
  const { data: access } = await supabase
    .from("client_users")
    .select("role")
    .eq("client_id", client.id)
    .eq("user_id", user.id)
    .single();

  if (!access) redirect("/clients");

  const statsCards = [
    {
      label: "Опубликовано",
      value: 0,
      icon: CheckCircle2,
      color: "text-lime-400",
      bg: "bg-lime-500/10",
    },
    {
      label: "Запланировано",
      value: 0,
      icon: Clock,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Аккаунтов",
      value: 0,
      icon: Wifi,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "Черновиков",
      value: 0,
      icon: FileText,
      color: "text-muted",
      bg: "bg-surface-4",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-semibold">{client.name}</h1>
          <p className="text-muted text-sm mt-0.5">{client.timezone}</p>
        </div>
        <Link
          href={`/${workspace}/content/new`}
          className="flex items-center gap-2 bg-lime-500 hover:bg-lime-400 text-black font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Создать пост
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statsCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-surface-2 border border-border rounded-xl p-4">
            <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-white text-2xl font-bold">{value}</p>
            <p className="text-muted text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Posts */}
        <div className="lg:col-span-2 bg-surface-2 border border-border rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-white font-medium text-sm">Последние публикации</h2>
            <Link
              href={`/${workspace}/content`}
              className="text-muted hover:text-lime-400 text-xs transition-colors"
            >
              Все →
            </Link>
          </div>

          <div className="p-8 text-center">
            <CalendarDays className="w-8 h-8 text-white/40 mx-auto mb-2" />
            <p className="text-muted text-sm">Нет публикаций</p>
            <Link
              href={`/${workspace}/content/new`}
              className="inline-flex items-center gap-1 text-lime-400 hover:text-lime-300 text-xs mt-2 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Создать первый пост
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <div className="bg-surface-2 border border-border rounded-xl p-4">
            <h2 className="text-white font-medium text-sm mb-3">Быстрые действия</h2>
            <div className="space-y-2">
              {[
                {
                  href: `/${workspace}/content/new`,
                  icon: Plus,
                  label: "Создать пост",
                  sub: "вручную или через AI",
                  lime: true,
                },
                {
                  href: `/${workspace}/accounts`,
                  icon: Wifi,
                  label: "Аккаунты",
                  sub: "0 подключено",
                },
                {
                  href: `/${workspace}/trends`,
                  icon: TrendingUp,
                  label: "Тренды",
                  sub: "TikTok & Instagram",
                },
                {
                  href: `/${workspace}/analytics`,
                  icon: BarChart2,
                  label: "Аналитика",
                  sub: "охваты и ER",
                },
              ].map(({ href, icon: Icon, label, sub, lime }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    lime
                      ? "bg-lime-500/10 hover:bg-lime-500/20 border border-lime-500/20"
                      : "hover:bg-surface-3"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${lime ? "text-lime-400" : "text-muted"}`}
                  />
                  <div className="min-w-0">
                    <p className={`text-xs font-medium ${lime ? "text-lime-400" : "text-white"}`}>
                      {label}
                    </p>
                    <p className="text-muted text-[10px]">{sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
