import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST — create invite for a client
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspace, email, role = "client" } = await req.json();

  if (!workspace || !email) {
    return NextResponse.json({ error: "workspace и email обязательны" }, { status: 400 });
  }

  const validRoles = ["client", "operator"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Get client
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", workspace)
    .single();

  if (!client) return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });

  // Only owner / operator can invite
  const { data: access } = await supabase
    .from("client_users")
    .select("role")
    .eq("client_id", client.id)
    .eq("user_id", user.id)
    .single();

  if (!access || access.role === "client") {
    return NextResponse.json({ error: "Нет прав для приглашения" }, { status: 403 });
  }

  // Create invite
  const { data: invite, error } = await supabase
    .from("invites")
    .insert({
      client_id: client.id,
      email,
      role,
    })
    .select("token")
    .single();

  if (error) {
    console.error("invites-create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://smm.morrowlab.by";
  const link = `${appUrl}/invite/${invite.token}`;

  return NextResponse.json({ link, token: invite.token });
}

// GET — list invites for a workspace
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = req.nextUrl.searchParams.get("workspace") ?? "";

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", workspace)
    .single();

  if (!client) return NextResponse.json({ invites: [] });

  // Access check — only owner or operator can list invites
  const { data: access } = await supabase
    .from("client_users")
    .select("role")
    .eq("client_id", client.id)
    .eq("user_id", user.id)
    .single();

  if (!access || access.role === "client") {
    return NextResponse.json({ error: "Нет прав для просмотра приглашений" }, { status: 403 });
  }

  const { data: invites } = await supabase
    .from("invites")
    .select("*")
    .eq("client_id", client.id)
    .order("expires_at", { ascending: false });

  return NextResponse.json({ invites: invites ?? [] });
}
