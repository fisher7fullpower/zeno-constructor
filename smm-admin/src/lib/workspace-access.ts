import { createClient } from "@/lib/supabase/server";

export async function checkWorkspaceAccess(workspace: string): Promise<{ clientId: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", workspace)
    .single();
  if (!client) return null;

  const { data: access } = await supabase
    .from("client_users")
    .select("role")
    .eq("client_id", (client as { id: string }).id)
    .eq("user_id", user.id)
    .single();
  if (!access) return null;

  return { clientId: (client as { id: string }).id };
}
