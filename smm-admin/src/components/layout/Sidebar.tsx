"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap,
  LayoutGrid,
  CalendarDays,
  Wifi,
  TrendingUp,
  BarChart2,
  Settings,
  Users,
  ChevronDown,
  LogOut,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client } from "@/lib/supabase/types";

interface SidebarProps {
  clients: Client[];
  currentSlug: string;
  userEmail: string;
  isOwner: boolean;
  onSignOut: () => void;
}

const workspaceNav = [
  { href: "", label: "Обзор", icon: LayoutGrid },
  { href: "/content", label: "Контент", icon: CalendarDays },
  { href: "/accounts", label: "Аккаунты", icon: Wifi },
  { href: "/trends", label: "Тренды", icon: TrendingUp },
  { href: "/analytics", label: "Аналитика", icon: BarChart2 },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export default function Sidebar({
  clients,
  currentSlug,
  userEmail,
  isOwner,
  onSignOut,
}: SidebarProps) {
  const pathname = usePathname();
  const currentClient = clients.find((c) => c.slug === currentSlug);

  return (
    <aside className="w-56 shrink-0 bg-surface-1 border-r border-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border shrink-0">
        <div className="w-7 h-7 bg-lime-500 rounded-md flex items-center justify-center">
          <Zap className="w-4 h-4 text-black" />
        </div>
        <span className="text-white font-semibold text-sm">SMM Admin</span>
      </div>

      {/* Client Switcher */}
      <div className="px-3 py-3 border-b border-border shrink-0">
        <p className="text-muted text-[10px] uppercase tracking-wider mb-2 px-1">Клиент</p>
        <div className="relative">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-3 transition-colors text-left group">
            <div className="w-6 h-6 rounded bg-lime-500/20 flex items-center justify-center shrink-0">
              <span className="text-lime-400 text-[10px] font-bold uppercase">
                {currentClient?.name?.slice(0, 2) ?? "??"}
              </span>
            </div>
            <span className="text-white text-xs font-medium truncate flex-1">
              {currentClient?.name ?? "Выбрать"}
            </span>
            <ChevronDown className="w-3 h-3 text-white/40 group-hover:text-white transition-colors shrink-0" />
          </button>

          {/* Dropdown with all clients */}
          {clients.length > 1 && (
            <div className="mt-1 space-y-0.5">
              {clients
                .filter((c) => c.slug !== currentSlug)
                .map((client) => (
                  <Link
                    key={client.id}
                    href={`/${client.slug}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-3 transition-colors"
                  >
                    <div className="w-6 h-6 rounded bg-surface-4 flex items-center justify-center shrink-0">
                      <span className="text-muted text-[10px] font-bold uppercase">
                        {client.name.slice(0, 2)}
                      </span>
                    </div>
                    <span className="text-muted hover:text-white text-xs truncate transition-colors">
                      {client.name}
                    </span>
                  </Link>
                ))}
            </div>
          )}
        </div>

        {isOwner && (
          <Link
            href="/clients/new"
            className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-md text-white/40 hover:text-lime-400 hover:bg-lime-500/10 transition-colors text-xs"
          >
            <Plus className="w-3 h-3" />
            Добавить клиента
          </Link>
        )}
      </div>

      {/* Workspace nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {workspaceNav.map(({ href, label, icon: Icon }) => {
          const to = `/${currentSlug}${href}`;
          const isActive = pathname === to || (href !== "" && pathname.startsWith(to));

          return (
            <Link
              key={href}
              href={to}
              className={cn(
                "flex items-center gap-2.5 px-2 py-2 rounded-md text-xs transition-colors",
                isActive
                  ? "bg-lime-500/10 text-lime-400 font-medium"
                  : "text-muted hover:text-white hover:bg-surface-3"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-lime-400" : "")} />
              {label}
            </Link>
          );
        })}

        {isOwner && (
          <>
            <div className="pt-3 pb-1">
              <div className="h-px bg-border" />
            </div>
            <Link
              href="/clients"
              className={cn(
                "flex items-center gap-2.5 px-2 py-2 rounded-md text-xs transition-colors",
                pathname === "/clients"
                  ? "bg-lime-500/10 text-lime-400 font-medium"
                  : "text-muted hover:text-white hover:bg-surface-3"
              )}
            >
              <Users className="w-4 h-4 shrink-0" />
              Все клиенты
            </Link>
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-border shrink-0">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-6 h-6 rounded-full bg-surface-4 flex items-center justify-center shrink-0">
            <span className="text-muted text-[10px] font-bold uppercase">
              {userEmail?.[0] ?? "?"}
            </span>
          </div>
          <span className="text-muted text-xs truncate flex-1">{userEmail}</span>
          <button
            onClick={onSignOut}
            className="text-muted hover:text-red-400 transition-colors"
            title="Выйти"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
