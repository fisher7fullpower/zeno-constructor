import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function platformLabel(platform: string): string {
  const labels: Record<string, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    vk: "ВКонтакте",
    telegram: "Telegram",
    facebook: "Facebook",
    youtube: "YouTube",
  };
  return labels[platform] ?? platform;
}

export function platformColor(platform: string): string {
  const colors: Record<string, string> = {
    instagram: "from-purple-500 to-pink-500",
    tiktok: "from-gray-900 to-gray-700",
    vk: "from-blue-500 to-blue-700",
    telegram: "from-sky-400 to-sky-600",
    facebook: "from-blue-600 to-blue-800",
    youtube: "from-red-500 to-red-700",
  };
  return colors[platform] ?? "from-gray-500 to-gray-700";
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    published: "Опубликован",
    scheduled: "Запланирован",
    draft: "Черновик",
    pending_approval: "На проверке",
    failed: "Ошибка",
  };
  return labels[status] ?? status;
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + "…" : str;
}
