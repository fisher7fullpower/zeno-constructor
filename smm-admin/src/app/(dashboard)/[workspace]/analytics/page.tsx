import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BarChart2 } from "lucide-react";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function AnalyticsPage({ params }: Props) {
  const { workspace } = await params;

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

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-white text-2xl font-semibold">Аналитика</h1>
        <p className="text-muted text-sm mt-0.5">{client.name}</p>
      </div>

      <div className="bg-surface-2 border border-border rounded-xl p-12 text-center">
        <BarChart2 className="w-10 h-10 text-white/40 mx-auto mb-3" />
        <p className="text-white font-medium mb-1">Аналитика скоро</p>
        <p className="text-muted text-sm">
          Раздел аналитики находится в разработке
        </p>
      </div>
    </div>
  );
}
