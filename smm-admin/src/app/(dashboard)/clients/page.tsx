import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Plus, Building2, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: clientUsers } = await supabase
    .from("client_users")
    .select("role, clients(*)")
    .eq("user_id", user.id);

  const clients = clientUsers
    ?.map((cu) => ({ ...cu.clients, role: cu.role }))
    .filter(Boolean) ?? [];

  const isAdmin = (user as { role?: string }).role === "admin";
  const isOwner = isAdmin || (clientUsers?.some((cu) => cu.role === "owner") ?? false);

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Клиенты</h1>
          <p className="text-muted text-sm mt-0.5">
            {clients.length} {clients.length === 1 ? "клиент" : "клиентов"}
          </p>
        </div>
        {isOwner && (
          <Link
            href="/clients/new"
            className="flex items-center gap-2 bg-lime-500 hover:bg-lime-400 text-black font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </Link>
        )}
      </div>

      {/* Clients grid */}
      {clients.length === 0 ? (
        <div className="bg-surface-2 border border-border rounded-xl p-12 text-center">
          <Building2 className="w-10 h-10 text-white/40 mx-auto mb-3" />
          <p className="text-white font-medium mb-1">Нет клиентов</p>
          <p className="text-muted text-sm mb-4">Добавьте первого клиента чтобы начать</p>
          {isOwner && (
            <Link
              href="/clients/new"
              className="inline-flex items-center gap-2 bg-lime-500 hover:bg-lime-400 text-black font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Создать клиента
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {clients.map((client: Record<string, unknown>) => (
            <Link
              key={client.id}
              href={`/${client.slug}`}
              className="group bg-surface-2 hover:bg-surface-3 border border-border rounded-xl p-4 flex items-center gap-4 transition-colors"
            >
              <div className="w-11 h-11 rounded-lg bg-lime-500/20 flex items-center justify-center shrink-0">
                <span className="text-lime-400 font-bold text-sm uppercase">
                  {client.name?.slice(0, 2)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">{client.name}</p>
                <p className="text-muted text-xs mt-0.5">
                  {client.timezone} · создан {formatDate(client.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted text-xs bg-surface-4 px-2 py-0.5 rounded-full">
                  {client.role === "owner" ? "Владелец" : client.role === "operator" ? "Оператор" : "Клиент"}
                </span>
                <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
