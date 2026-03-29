import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: clientUsers, error } = await supabase
    .from("client_users")
    .select("role, clients(*)")
    .eq("user_id", user.id);

  if (error) {
    console.error("clients-list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const clients = clientUsers?.map((cu) => ({
    ...cu.clients,
    role: cu.role,
  })) ?? [];

  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, slug, timezone } = await req.json();

  if (!name || !slug) {
    return NextResponse.json({ error: "name и slug обязательны" }, { status: 400 });
  }

  // Create client in Supabase
  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      name,
      slug,
      timezone: timezone ?? "Europe/Minsk",
      owner_id: user.id,
      brand_kit: {},
      schedule: {},
      require_approval: true,
    })
    .select()
    .single();

  if (error) {
    console.error("clients-create error:", error);
    return NextResponse.json(
      { error: error.code === "23505" ? "Такой slug уже занят" : "Internal server error" },
      { status: error.code === "23505" ? 400 : 500 }
    );
  }

  // Add owner as client_user
  await supabase.from("client_users").insert({
    client_id: client.id,
    user_id: user.id,
    role: "owner",
  });

  return NextResponse.json({ id: client.id, slug: client.slug });
}
