"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Sparkles, Upload, Calendar, Send, Loader2, X,
  Copy, Check, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import Link from "next/link";
import type { GenerateResult } from "@/app/api/generate/route";

// ── Constants ────────────────────────────────────────────────────────────────

const POST_TYPES = [
  { id: "showcase",     label: "Готовый проект",   emoji: "🏠" },
  { id: "before_after", label: "До / После",        emoji: "🔄" },
  { id: "tips",         label: "Советы",            emoji: "💡" },
  { id: "materials",    label: "Материалы",         emoji: "🪵" },
  { id: "promo",        label: "Акция",             emoji: "🎯" },
  { id: "story",        label: "История клиента",   emoji: "⭐" },
];

const ROOMS = [
  { id: "bathroom", label: "Ванная" },
  { id: "kitchen",  label: "Кухня" },
  { id: "living",   label: "Гостиная" },
  { id: "bedroom",  label: "Спальня" },
  { id: "office",   label: "Кабинет" },
  { id: "exterior", label: "Фасад" },
];

const STYLES = [
  { id: "minimalism",     label: "Минимализм" },
  { id: "scandinavian",   label: "Скандинавский" },
  { id: "loft",           label: "Лофт" },
  { id: "modern_classic", label: "Совр. классика" },
  { id: "neoclassic",     label: "Неоклассика" },
];

const TONES = [
  { id: "inspiring",      label: "Вдохновляющий" },
  { id: "educational",    label: "Экспертный" },
  { id: "conversational", label: "Живой" },
  { id: "promotional",    label: "Продающий" },
];

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok",    label: "TikTok" },
  { id: "vk",        label: "ВКонтакте" },
  { id: "telegram",  label: "Telegram" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Account { id: string; platform: string; name: string; username?: string; }

// ── Chip / Toggle helpers ─────────────────────────────────────────────────────

function Chip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
        active
          ? "bg-lime-500/20 border-lime-500/40 text-lime-400"
          : "bg-surface-4 border-border text-white/40 hover:text-white hover:border-surface-5"
      }`}
    >
      {children}
    </button>
  );
}

// ── Variant card ──────────────────────────────────────────────────────────────

function VariantCard({
  variant, index, selected, onSelect,
}: {
  variant: GenerateResult["variants"][0];
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [hashOpen, setHashOpen] = useState(false);

  function copy() {
    const text = variant.caption + "\n\n" + variant.hashtags.join(" ");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-all cursor-pointer ${
        selected
          ? "border-lime-500/50 bg-lime-500/5 ring-1 ring-lime-500/20"
          : "border-border bg-surface-2 hover:border-surface-5"
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            selected ? "border-lime-400 bg-lime-400" : "border-border"
          }`}>
            {selected && <Check className="w-3 h-3 text-black" />}
          </div>
          <span className="text-white/60 text-xs font-medium">Вариант {index + 1}</span>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); copy(); }}
          className="flex items-center gap-1 text-white/40 hover:text-white text-xs transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-lime-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>

      {/* Caption */}
      <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap mb-3">
        {variant.caption}
      </p>

      {/* Visual prompt */}
      <div className="bg-surface-4 rounded-lg px-3 py-2 mb-3">
        <p className="text-muted text-[11px] mb-0.5">📷 Визуал:</p>
        <p className="text-white/70 text-xs leading-relaxed">{variant.visualPrompt}</p>
      </div>

      {/* Hashtags toggle */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setHashOpen(!hashOpen); }}
        className="flex items-center gap-1 text-white/40 hover:text-white text-xs transition-colors"
      >
        {hashOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {variant.hashtags.length} хештегов
      </button>
      {hashOpen && (
        <div className="mt-2 flex flex-wrap gap-1">
          {variant.hashtags.map((h) => (
            <span key={h} className="text-lime-400/70 text-[11px] bg-lime-500/10 rounded px-1.5 py-0.5">
              {h}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

function NewPostForm() {
  const router = useRouter();
  const { workspace } = useParams<{ workspace: string }>();
  const searchParams = useSearchParams();
  const initAi = searchParams.get("ai") === "1";

  // Steps: "ai" → generate, "review" → choose variant, "publish" → final
  const [step, setStep] = useState<"ai" | "review" | "publish">(initAi ? "ai" : "publish");

  // AI params
  const [postType, setPostType]         = useState("showcase");
  const [room, setRoom]                 = useState("bathroom");
  const [style, setStyle]               = useState("minimalism");
  const [tone, setTone]                 = useState("inspiring");
  const [platforms, setPlatforms]       = useState<string[]>(["instagram"]);
  const [projectDetails, setDetails]    = useState("");
  const [budget, setBudget]             = useState("");

  // Generation state
  const [generating, setGenerating]     = useState(false);
  const [genResult, setGenResult]       = useState<GenerateResult | null>(null);
  const [selectedVariant, setSelected]  = useState(0);

  // Publish state
  const [accounts, setAccounts]         = useState<Account[]>([]);
  const [selectedAccounts, setAccs]     = useState<string[]>([]);
  const [caption, setCaption]           = useState("");
  const [mediaUrl, setMediaUrl]         = useState("");
  const [scheduledAt, setScheduledAt]   = useState("");
  const [isDraft, setIsDraft]           = useState(false);
  const [publishing, setPublishing]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/accounts?workspace=${workspace}`)
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []))
      .catch(() => {});
  }, [workspace]);

  function togglePlatform(id: string) {
    setPlatforms((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }
  function toggleAccount(id: string) {
    setAccs((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setGenResult(null);

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace, postType, room, style, tone, platforms, projectDetails, budget }),
    });

    if (!res.ok) {
      const { error: msg } = await res.json();
      setError(msg ?? "Ошибка генерации");
      setGenerating(false);
      return;
    }

    const result: GenerateResult = await res.json();
    setGenResult(result);
    setSelected(0);
    // Pre-fill caption with first variant
    const v = result.variants[0];
    setCaption(v.caption + "\n\n" + v.hashtags.join(" "));
    setStep("review");
    setGenerating(false);
  }

  function applyVariant(idx: number) {
    setSelected(idx);
    if (!genResult) return;
    const v = genResult.variants[idx];
    setCaption(v.caption + "\n\n" + v.hashtags.join(" "));
  }

  function goToPublish() {
    setStep("publish");
  }

  async function handlePublish(asDraft = false) {
    setPublishing(true);
    setError(null);

    const res = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace,
        accountIds: selectedAccounts,
        caption,
        mediaUrls: mediaUrl ? [mediaUrl] : [],
        scheduledAt: scheduledAt || undefined,
        isDraft: asDraft,
      }),
    });

    if (!res.ok) {
      const { error: msg } = await res.json();
      setError(msg ?? "Ошибка публикации");
      setPublishing(false);
      return;
    }

    router.push(`/${workspace}/content`);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-2xl">
      {/* Back */}
      <Link
        href={`/${workspace}/content`}
        className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад к контенту
      </Link>

      {/* Step tabs */}
      <div className="flex items-center gap-1 bg-surface-2 border border-border rounded-xl p-1 mb-6">
        <button
          onClick={() => setStep("ai")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
            step === "ai" ? "bg-lime-500/20 text-lime-400" : "text-muted hover:text-white"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI Генератор
        </button>
        <button
          onClick={() => genResult && setStep("review")}
          disabled={!genResult}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-30 ${
            step === "review" ? "bg-surface-4 text-white" : "text-muted hover:text-white"
          }`}
        >
          Выбор варианта
          {genResult && <span className="ml-1 w-4 h-4 rounded-full bg-lime-500 text-black text-[9px] font-bold flex items-center justify-center">3</span>}
        </button>
        <button
          onClick={() => setStep("publish")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
            step === "publish" ? "bg-surface-4 text-white" : "text-muted hover:text-white"
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          Публикация
        </button>
      </div>

      <div className="space-y-4">

        {/* ── STEP: AI ── */}
        {step === "ai" && (
          <>
            {/* Post type */}
            <div className="bg-surface-2 border border-border rounded-xl p-5 space-y-3">
              <h2 className="text-white font-medium text-sm">Тип поста</h2>
              <div className="grid grid-cols-3 gap-2">
                {POST_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPostType(t.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                      postType === t.id
                        ? "border-lime-500/50 bg-lime-500/10 text-lime-400"
                        : "border-border bg-surface-4 text-white/40 hover:text-white hover:border-surface-5"
                    }`}
                  >
                    <span className="text-xl">{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Room + Style */}
            <div className="bg-surface-2 border border-border rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-white font-medium text-sm mb-2">Комната / пространство</h2>
                <div className="flex flex-wrap gap-2">
                  {ROOMS.map((r) => (
                    <Chip key={r.id} active={room === r.id} onClick={() => setRoom(r.id)}>
                      {r.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-white font-medium text-sm mb-2">Стиль интерьера</h2>
                <div className="flex flex-wrap gap-2">
                  {STYLES.map((s) => (
                    <Chip key={s.id} active={style === s.id} onClick={() => setStyle(s.id)}>
                      {s.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>

            {/* Tone + Platform */}
            <div className="bg-surface-2 border border-border rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-white font-medium text-sm mb-2">Тон текста</h2>
                <div className="flex flex-wrap gap-2">
                  {TONES.map((t) => (
                    <Chip key={t.id} active={tone === t.id} onClick={() => setTone(t.id)}>
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-white font-medium text-sm mb-2">Платформы</h2>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <Chip key={p.id} active={platforms.includes(p.id)} onClick={() => togglePlatform(p.id)}>
                      {p.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="bg-surface-2 border border-border rounded-xl p-5 space-y-3">
              <h2 className="text-white font-medium text-sm">Детали проекта</h2>
              <textarea
                value={projectDetails}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Опишите проект: площадь, особенности, что хотите подчеркнуть…"
                rows={3}
                className="w-full bg-surface-4 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-lime-500 transition-colors resize-none"
              />
              <div>
                <label className="block text-white/60 text-xs mb-1.5">Бюджет (необязательно)</label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="например: 5000–8000 BYN"
                  className="w-full bg-surface-4 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-lime-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-lime-500 hover:bg-lime-400 disabled:opacity-60 text-black font-bold rounded-xl py-3.5 text-sm transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Генерируем 3 варианта…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Сгенерировать 3 варианта
                </>
              )}
            </button>
          </>
        )}

        {/* ── STEP: REVIEW ── */}
        {step === "review" && genResult && (
          <>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-medium">Выберите вариант</h2>
              <button
                type="button"
                onClick={() => setStep("ai")}
                className="flex items-center gap-1.5 text-white/40 hover:text-white text-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Перегенерировать
              </button>
            </div>

            <p className="text-muted text-xs -mt-2 mb-3">
              Нажмите на вариант, затем нажмите «Использовать»
            </p>

            <div className="space-y-3">
              {genResult.variants.map((v, i) => (
                <VariantCard
                  key={i}
                  variant={v}
                  index={i}
                  selected={selectedVariant === i}
                  onSelect={() => applyVariant(i)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={goToPublish}
              className="w-full flex items-center justify-center gap-2 bg-lime-500 hover:bg-lime-400 text-black font-bold rounded-xl py-3 text-sm transition-colors mt-2"
            >
              <Check className="w-4 h-4" />
              Использовать вариант {selectedVariant + 1}
            </button>
          </>
        )}

        {/* ── STEP: PUBLISH ── */}
        {step === "publish" && (
          <>
            {/* AI indicator */}
            {genResult && (
              <div className="flex items-center gap-2 bg-lime-500/10 border border-lime-500/20 rounded-xl px-4 py-2.5">
                <Sparkles className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                <p className="text-lime-400 text-xs">Использован вариант {selectedVariant + 1} от AI</p>
                <button
                  type="button"
                  onClick={() => setStep("review")}
                  className="ml-auto text-lime-400/60 hover:text-lime-400 text-xs underline"
                >
                  Сменить
                </button>
              </div>
            )}

            {/* Accounts */}
            <div className="bg-surface-2 border border-border rounded-xl p-5 space-y-3">
              <h2 className="text-white font-medium text-sm">Аккаунты для публикации</h2>
              {accounts.length === 0 ? (
                <div className="bg-surface-4 rounded-lg p-3 text-center">
                  <p className="text-muted text-xs">
                    Нет подключённых аккаунтов.{" "}
                    <Link href={`/${workspace}/accounts`} className="text-lime-400 hover:underline">
                      Подключить →
                    </Link>
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => toggleAccount(acc.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                        selectedAccounts.includes(acc.id)
                          ? "border-lime-500/40 bg-lime-500/10"
                          : "border-border hover:border-surface-5"
                      }`}
                    >
                      <div className="w-7 h-7 rounded-md bg-surface-4 flex items-center justify-center shrink-0">
                        <span className="text-muted text-[10px] uppercase font-bold">{acc.platform.slice(0, 2)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-medium truncate ${selectedAccounts.includes(acc.id) ? "text-lime-400" : "text-white"}`}>{acc.name}</p>
                        <p className="text-muted text-[10px]">{acc.platform}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Caption */}
            <div className="bg-surface-2 border border-border rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-medium text-sm">Текст публикации</h2>
                {!genResult && (
                  <Link
                    href={`/${workspace}/content/new?ai=1`}
                    className="flex items-center gap-1 text-lime-400 hover:text-lime-300 text-xs transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    Сгенерировать AI
                  </Link>
                )}
              </div>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Напиши подпись к посту…"
                rows={6}
                className="w-full bg-surface-4 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-lime-500 transition-colors resize-none"
              />
              <p className="text-muted text-xs text-right">{caption.length} симв.</p>
            </div>

            {/* Media */}
            <div className="bg-surface-2 border border-border rounded-xl p-5 space-y-3">
              <h2 className="text-white font-medium text-sm">Медиафайл</h2>
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://... (URL изображения или видео)"
                className="w-full bg-surface-4 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-lime-500 transition-colors"
              />
              {mediaUrl && (
                <div className="relative w-full aspect-video bg-surface-4 rounded-lg overflow-hidden">
                  {mediaUrl.match(/\.(mp4|mov|webm)$/i) ? (
                    <video src={mediaUrl} className="w-full h-full object-contain" controls />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl} alt="preview" className="w-full h-full object-contain" />
                  )}
                  <button
                    type="button"
                    onClick={() => setMediaUrl("")}
                    className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white hover:bg-black"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <Upload className="w-3 h-3" />
                Поддерживаются: JPG, PNG, MP4, MOV
              </div>
            </div>

            {/* Schedule */}
            <div className="bg-surface-2 border border-border rounded-xl p-5 space-y-3">
              <h2 className="text-white font-medium text-sm">Расписание</h2>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-white/40 shrink-0" />
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="flex-1 bg-surface-4 border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-lime-500 transition-colors"
                />
              </div>
              <p className="text-muted text-xs">Оставьте пустым для немедленной публикации</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handlePublish(true)}
                disabled={publishing || !caption}
                className="flex-1 bg-surface-2 hover:bg-surface-3 border border-border text-white font-medium rounded-xl py-3 text-sm transition-colors disabled:opacity-50"
              >
                Сохранить черновик
              </button>
              <button
                type="button"
                onClick={() => handlePublish(false)}
                disabled={publishing || !caption || selectedAccounts.length === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black font-bold rounded-xl py-3 text-sm transition-colors"
              >
                {publishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {scheduledAt ? "Запланировать" : "Опубликовать"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function NewPostPage() {
  return (
    <Suspense fallback={
      <div className="p-6 flex items-center gap-2 text-white/40">
        <Loader2 className="w-4 h-4 animate-spin" />
        Загрузка…
      </div>
    }>
      <NewPostForm />
    </Suspense>
  );
}
