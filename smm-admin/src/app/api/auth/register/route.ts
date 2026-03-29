import { NextRequest, NextResponse } from "next/server";
import { isLicensedEmail, createMagicToken, createUser } from "@/lib/auth";
import pool from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://smm.morrowlab.by";

export async function POST(req: NextRequest) {
  try {
    const ip = (await headers()).get("x-forwarded-for") ?? "unknown";
    if (!rateLimit("register:" + ip, 5, 60000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { email } = await req.json();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json({ error: "Введите корректный email" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const { rows: existing } = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existing.length > 0) {
      // Send magic link for existing user
      const token = await createMagicToken(normalizedEmail, "login");
      const link = `${APP_URL}/api/auth/confirm?token=${token}`;
      await sendMagicEmail(normalizedEmail, link, false);
      return NextResponse.json({ sent: true });
    }

    // New user — check license
    const { licensed, plan } = await isLicensedEmail(normalizedEmail);
    if (!licensed) {
      return NextResponse.json(
        { error: "Этот email не найден в системе. Приобретите пакет на morrowlab.by или попросите приглашение у администратора." },
        { status: 403 }
      );
    }

    // Create user with random password (access only via magic link or set password later)
    const tempPassword = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const user = await createUser(
      normalizedEmail,
      tempPassword,
      plan === "partner" ? "operator" : "client"
    );

    // Mark licensed email as activated
    await pool.query(
      "UPDATE licensed_emails SET activated_at = now() WHERE email = $1",
      [normalizedEmail]
    );

    // Send magic link
    const token = await createMagicToken(normalizedEmail, "register");
    const link = `${APP_URL}/api/auth/confirm?token=${token}`;
    await sendMagicEmail(normalizedEmail, link, true, plan);

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

async function sendMagicEmail(to: string, link: string, isNew: boolean, plan?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[register] Magic link generated for ${to}`);
    return;
  }

  const subject = isNew
    ? "Добро пожаловать в SMM Admin — войдите по ссылке"
    : "Ссылка для входа — SMM Admin";

  const safePlan = plan ? plan.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';

  const description = isNew
    ? `Аккаунт успешно создан!${safePlan ? ` Пакет: <strong>${safePlan}</strong>.` : ""} Нажмите кнопку ниже для входа.`
    : "Аккаунт уже существует. Нажмите кнопку ниже для входа без пароля.";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SMM Admin <hello@morrowlab.by>",
      to,
      subject,
      html: emailHtml("Войти в SMM Admin", link, description),
    }),
  });
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function emailHtml(buttonText: string, link: string, description: string) {
  return `<!DOCTYPE html>
<html><body style="background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;margin:0;padding:40px 0">
<div style="max-width:480px;margin:0 auto;background:#111113;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:32px">
  <div style="margin-bottom:24px">
    <span style="display:inline-block;background:#d1fe17;color:#040406;font-weight:700;font-size:13px;padding:4px 10px;border-radius:6px">SMM Admin</span>
  </div>
  <p style="color:rgba(255,255,255,.7);font-size:14px;line-height:1.6;margin:0 0 24px">${description}</p>
  <a href="${escAttr(link)}" style="display:inline-block;background:#d1fe17;color:#040406;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;margin-bottom:20px">${buttonText}</a>
  <p style="color:rgba(255,255,255,.3);font-size:12px;margin:16px 0 0">Ссылка действительна 24 часа. Если вы не запрашивали доступ — просто проигнорируйте это письмо.</p>
</div>
</body></html>`;
}
