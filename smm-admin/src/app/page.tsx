import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Only show clients the user has access to via client_users
  const { data: clientUsers } = await supabase
    .from("client_users")
    .select("role, clients(*)")
    .eq("user_id", user.id)
    .limit(1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const firstClient = (clientUsers?.[0]?.clients as any);
  if (firstClient?.slug) {
    redirect(`/${firstClient.slug}`);
  }

  // No clients yet -> go to clients list
  redirect("/clients");
}
