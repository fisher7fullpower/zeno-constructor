import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrendingUp, Hash, Volume2, ExternalLink, Zap } from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ workspace: string }>;
}

// Mock trends data (будет заменено на реальный n8n webhook в Sprint 2)
const MOCK_TRENDS = {
  tiktok: {
    hashtags: [
      { tag: "#дизайнинтерьера", views: 125_000_000, growth: 23 },
      { tag: "#ремонт2026", views: 84_000_000, growth: 41 },
      { tag: "#квартира", views: 210_000_000, growth: 12 },
      { tag: "#дом", views: 340_000_000, growth: 8 },
      { tag: "#минимализм", views: 67_000_000, growth: 31 },
    ],
    sounds: [
      { name: "lofi bedroom beats", uses: 450_000 },
      { name: "aesthetic apartment tour", uses: 280_000 },
      { name: "cozy home vibes", uses: 190_000 },
    ],
  },
  instagram: {
    hashtags: [
      { tag: "#interiordesign", views: 890_000_000, growth: 5 },
      { tag: "#homedecor", views: 1_200_000_000, growth: 3 },
      { tag: "#modernhome", views: 340_000_000, growth: 18 },
      { tag: "#scandinaviandesign", views: 120_000_000, growth: 22 },
      { tag: "#renovationbelarusminsk", views: 3_400_000, growth: 67 },
    ],
  },
};

export default async function TrendsPage({ params }: Props) {
  const { workspace } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", workspace)
    .single();

  if (!client) notFound();

  const { data: access } = await supabase
    .from("client_users")
    .select("role")
    .eq("client_id", client.id)
    .eq("user_id", user.id)
    .single();

  if (!access) redirect("/clients");

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-semibold">Тренды</h1>
          <p className="text-muted text-sm mt-0.5">TikTok & Instagram · Минск / Беларусь</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${workspace}/content/new?ai=1`}
            className="flex items-center gap-2 bg-lime-500 hover:bg-lime-400 text-black font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
          >
            <Zap className="w-4 h-4" />
            Генерировать по тренду
          </Link>
        </div>
      </div>

      {/* Beta notice */}
      <div className="bg-surface-2 border border-lime-500/20 rounded-xl p-4 flex items-start gap-3">
        <TrendingUp className="w-4 h-4 text-lime-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-lime-400 text-sm font-medium">Демо-данные</p>
          <p className="text-lime-400/60 text-xs mt-0.5">
            Реальные тренды из Apify (TikTok Trends Scraper) будут подключены в Sprint 2.
            Настроим n8n webhook /smm-trends с реальными данными.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* TikTok trends */}
        <div className="space-y-3">
          <h2 className="text-white font-medium text-sm flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-800 rounded flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">TT</span>
            </div>
            TikTok · Хэштеги
          </h2>

          <div className="bg-surface-2 border border-border rounded-xl divide-y divide-border overflow-hidden">
            {MOCK_TRENDS.tiktok.hashtags.map((trend, i) => (
              <div key={trend.tag} className="flex items-center gap-3 px-4 py-3">
                <span className="text-muted text-xs w-5 shrink-0">{i + 1}</span>
                <Hash className="w-3.5 h-3.5 text-white/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">{trend.tag}</p>
                  <p className="text-muted text-xs">
                    {(trend.views / 1_000_000).toFixed(0)}M просмотров
                  </p>
                </div>
                <span
                  className={`text-xs font-medium shrink-0 ${
                    trend.growth > 30
                      ? "text-lime-400"
                      : trend.growth > 15
                      ? "text-yellow-400"
                      : "text-muted"
                  }`}
                >
                  +{trend.growth}%
                </span>
              </div>
            ))}
          </div>

          {/* Trending sounds */}
          <h3 className="text-white/60 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Volume2 className="w-3 h-3" />
            Трендовые звуки
          </h3>
          <div className="bg-surface-2 border border-border rounded-xl divide-y divide-border overflow-hidden">
            {MOCK_TRENDS.tiktok.sounds.map((sound) => (
              <div key={sound.name} className="flex items-center gap-3 px-4 py-3">
                <Volume2 className="w-3.5 h-3.5 text-white/40 shrink-0" />
                <p className="text-white text-sm flex-1 truncate">{sound.name}</p>
                <p className="text-muted text-xs shrink-0">
                  {(sound.uses / 1000).toFixed(0)}K видео
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Instagram trends */}
        <div className="space-y-3">
          <h2 className="text-white font-medium text-sm flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-purple-500 to-pink-500 rounded flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">IG</span>
            </div>
            Instagram · Хэштеги
          </h2>

          <div className="bg-surface-2 border border-border rounded-xl divide-y divide-border overflow-hidden">
            {MOCK_TRENDS.instagram.hashtags.map((trend, i) => (
              <div key={trend.tag} className="flex items-center gap-3 px-4 py-3">
                <span className="text-muted text-xs w-5 shrink-0">{i + 1}</span>
                <Hash className="w-3.5 h-3.5 text-white/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">{trend.tag}</p>
                  <p className="text-muted text-xs">
                    {trend.views >= 1_000_000_000
                      ? (trend.views / 1_000_000_000).toFixed(1) + "B"
                      : (trend.views / 1_000_000).toFixed(0) + "M"}{" "}
                    публикаций
                  </p>
                </div>
                <span
                  className={`text-xs font-medium shrink-0 ${
                    trend.growth > 30
                      ? "text-lime-400"
                      : trend.growth > 10
                      ? "text-yellow-400"
                      : "text-muted"
                  }`}
                >
                  +{trend.growth}%
                </span>
              </div>
            ))}
          </div>

          {/* External links */}
          <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-3">
            <p className="text-white/60 text-xs uppercase tracking-wider">
              Источники трендов
            </p>
            {[
              {
                label: "TikTok Creative Center",
                url: "https://ads.tiktok.com/business/creativecenter/trends",
                desc: "Официальный инструмент трендов",
              },
              {
                label: "Google Trends",
                url: "https://trends.google.com/trends/?geo=BY",
                desc: "Поиск в Беларуси",
              },
              {
                label: "Publer Hashtag Analytics",
                url: "https://publer.io",
                desc: "Анализ хэштегов",
              },
            ].map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:bg-surface-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors group"
              >
                <ExternalLink className="w-3.5 h-3.5 text-white/40 shrink-0" />
                <div>
                  <p className="text-white text-xs group-hover:text-lime-400 transition-colors">
                    {link.label}
                  </p>
                  <p className="text-muted text-[10px]">{link.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
