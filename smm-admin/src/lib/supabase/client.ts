/**
 * Mock Supabase browser client — calls our own /api/auth/* routes.
 * Keeps the same interface as @supabase/supabase-js so pages don't change.
 */

type AuthUser = { id: string; email: string };
type AuthResult<T> = { data: T; error: { message: string } | null };

function makeBrowserAuth() {
  return {
    async signInWithPassword(
      { email, password }: { email: string; password: string }
    ): Promise<AuthResult<{ user: AuthUser | null }>> {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const json = await res.json();
        if (!res.ok) return { data: { user: null }, error: { message: json.error || "Ошибка входа" } };
        return { data: { user: json.user }, error: null };
      } catch {
        return { data: { user: null }, error: { message: "Ошибка сети" } };
      }
    },

    async signOut(): Promise<{ error: null }> {
      await fetch("/api/auth/logout", { method: "POST" });
      return { error: null };
    },

    async getUser(): Promise<AuthResult<{ user: AuthUser | null }>> {
      try {
        const res = await fetch("/api/auth/me");
        const json = await res.json();
        return { data: { user: json.user ?? null }, error: null };
      } catch {
        return { data: { user: null }, error: null };
      }
    },
  };
}

type BrowserClient = {
  auth: ReturnType<typeof makeBrowserAuth>;
};

export function createClient(): BrowserClient {
  return { auth: makeBrowserAuth() };
}
