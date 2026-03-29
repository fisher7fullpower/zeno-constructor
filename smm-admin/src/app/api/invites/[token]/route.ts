import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createUser, signToken } from "@/lib/auth";
import pool from "@/lib/db";

type Params = { params: Promise<{ token: string }> };

// GET — validate invite token
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: invite } = await supabase
    .from("invites")
    .select("*, clients(name)")
    .eq("token", token)
    .single();

  if (!invite) return NextResponse.json({ valid: false });
  if (invite.used) return NextResponse.json({ valid: false, used: true });
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ valid: false, expired: true });

  return NextResponse.json({
    valid: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client_name: (invite.clients as any)?.name,
    email: invite.email,
    role: invite.role,
  });
}

// POST — accept invite, create account, sign in
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const { password } = await req.json();

  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Пароль минимум 8 символов" }, { status: 400 });
  }
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ error: "Пароль должен содержать заглавную букву и цифру" }, { status: 400 });
  }

  // Fetch and validate invite
  const { rows: inviteRows } = await pool.query(
    `SELECT i.*, c.id AS client_id
     FROM invites i
     JOIN clients c ON c.id = i.client_id
     WHERE i.token = $1 AND i.used = false`,
    [token]
  );

  const invite = inviteRows[0];
  if (!invite) {
    return NextResponse.json({ error: "Приглашение не найдено или уже использовано" }, { status: 400 });
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Срок приглашения истёк" }, { status: 400 });
  }

  // Create user (or update password if already exists)
  const user = await createUser(invite.email, password, invite.role === "owner" ? "admin" : "client");

  // Link user → client
  await pool.query(
    `INSERT INTO client_users (client_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (client_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [invite.client_id, user.id, invite.role]
  );

  // Mark invite as used
  await pool.query("UPDATE invites SET used = true WHERE token = $1", [token]);

  // Issue JWT and set cookie
  const jwt = await signToken(user);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("sb_token", jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}
