import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ workspace: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { workspace } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", workspace)
    .single();

  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Access check
  const { data: access } = await supabase
    .from("client_users")
    .select("role")
    .eq("client_id", client.id)
    .eq("user_id", user.id)
    .single();

  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(client);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { workspace } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", workspace)
    .single();

  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only owner or operator can edit
  const { data: access } = await supabase
    .from("client_users")
    .select("role")
    .eq("client_id", client.id)
    .eq("user_id", user.id)
    .single();

  if (!access || access.role === "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const allowed = ['name', 'timezone', 'require_approval', 'brand_kit', 'schedule'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("clients")
    .update(updates)
    .eq("id", client.id);

  if (error) {
    console.error("clients-update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
