"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import type { Client } from "@/lib/supabase/types";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  const [clients, setClients] = useState<Client[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [isOwner, setIsOwner] = useState(false);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setUserEmail(user.email ?? "");

    const { data: clientUsers } = await supabase
      .from("client_users")
      .select("role, clients(*)")
      .eq("user_id", user.id);

    const allClients = clientUsers
      ?.map((cu) => cu.clients)
      .filter(Boolean)
      .flat() as Client[];

    setClients(allClients ?? []);
    setIsOwner(clientUsers?.some((cu) => cu.role === "owner") ?? false);
  }, [router, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Derive current workspace slug from pathname (e.g. /morrowlab/content → "morrowlab")
  const segments = pathname.split("/").filter(Boolean);
  const systemPaths = new Set(["clients", "login", "invite", "api"]);
  const currentSlug = segments[0] && !systemPaths.has(segments[0]) ? segments[0] : "";

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      <Sidebar
        clients={clients}
        currentSlug={currentSlug}
        userEmail={userEmail}
        isOwner={isOwner}
        onSignOut={handleSignOut}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
