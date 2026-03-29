import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import pool from "./db";

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET environment variable is required");
const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
}

export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain a number";
  return null;
}

export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({ email: user.email, role: user.role ?? "client" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return { id: payload.sub!, email: payload.email as string, role: payload.role as string | undefined };
  } catch {
    return null;
  }
}

export async function findUserByCredentials(
  email: string,
  password: string
): Promise<AuthUser | null> {
  const { rows } = await pool.query(
    "SELECT id, email, role, password_hash FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  if (!rows[0]) return null;
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  return ok ? { id: rows[0].id, email: rows[0].email, role: rows[0].role } : null;
}

export async function createUser(
  email: string,
  password: string,
  role = "client"
): Promise<AuthUser> {
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, role`,
    [email.toLowerCase(), hash, role]
  );
  if (!rows[0]) {
    throw new Error("User with this email already exists");
  }
  return { id: rows[0].id, email: rows[0].email, role: rows[0].role };
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const { rows } = await pool.query(
    "SELECT id, email, role FROM users WHERE id = $1",
    [id]
  );
  return rows[0] ?? null;
}

/** Check if email is in licensed_emails (purchased a package on morrowlab.by) */
export async function isLicensedEmail(email: string): Promise<{ licensed: boolean; plan?: string }> {
  const { rows } = await pool.query(
    "SELECT plan FROM licensed_emails WHERE email = $1",
    [email.toLowerCase()]
  );
  return rows[0] ? { licensed: true, plan: rows[0].plan } : { licensed: false };
}

/** Create a magic login token for passwordless auth */
export async function createMagicToken(email: string, purpose = "login"): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO magic_tokens (email, purpose)
     VALUES ($1, $2)
     RETURNING token`,
    [email.toLowerCase(), purpose]
  );
  return rows[0].token as string;
}

/** Validate and consume a magic token. Returns email if valid. */
export async function consumeMagicToken(token: string): Promise<{ email: string; purpose: string } | null> {
  const { rows } = await pool.query(
    `UPDATE magic_tokens
     SET used = true
     WHERE token = $1
       AND used = false
       AND expires_at > now()
     RETURNING email, purpose`,
    [token]
  );
  return rows[0] ?? null;
}
