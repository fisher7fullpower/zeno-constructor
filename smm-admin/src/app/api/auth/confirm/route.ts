import { NextRequest, NextResponse } from "next/server";
import { consumeMagicToken, signToken } from "@/lib/auth";
import pool from "@/lib/db";

// GET — redirect to the confirm page which will POST the token
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/auth/confirm?error=invalid_token", req.url));
  }
  // Redirect to the confirm page which auto-submits via POST
  return NextResponse.redirect(new URL(`/auth/confirm?token=${encodeURIComponent(token)}`, req.url));
}

// POST — actually consume the token and set cookie
export async function POST(req: NextRequest) {
  const { token } = await req.json();

  if (!token) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  const result = await consumeMagicToken(token);
  if (!result) {
    return NextResponse.json({ error: "expired_token" }, { status: 400 });
  }

  // Always use email from token, never from client
  const email = result.email.toLowerCase();

  const { rows } = await pool.query(
    "SELECT id, email, role FROM users WHERE email = $1",
    [email]
  );

  if (!rows[0]) {
    return NextResponse.json({ error: "user_not_found" }, { status: 400 });
  }

  const user = { id: rows[0].id, email: rows[0].email, role: rows[0].role };
  const jwt = await signToken(user);

  const res = NextResponse.json({ ok: true, redirect: "/clients" });
  res.cookies.set("sb_token", jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}
