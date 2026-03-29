"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Save,
  ExternalLink,
  Calendar,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { formatDate, platformLabel, statusLabel } from "@/lib/utils";

interface PmpMedia {
  type: "image" | "video";
  url: string;
  thumbnail?: string;
}

interface Post {
  id: string;
  status: string;
  caption: string;
  media: PmpMedia[];
  platforms: string[];
  account_ids: string[];
  scheduled_at?: string;
  published_at?: string;
  created_at: string;
  stats?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  published: <CheckCircle2 className="w-4 h-4 text-lime-400" />,
  scheduled: <Clock className="w-4 h-4 text-blue-400" />,
  failed: <AlertCircle className="w-4 h-4 text-red-400" />,
};

export default function PostDetailPage() {
  const { workspace, id } = useParams<{ workspace: string; id: string }>();
  const router = useRouter();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaIdx, setMediaIdx] = useState(0);

  useEffect(() => {
    fetch(`/api/content/${id}?workspace=${workspace}`)
      .then((r) => r.json())
      .then((data: Post) => {
        setPost(data);
        setCaption(data.caption ?? "");
        setScheduledAt(
          data.scheduled_at
            ? new Date(data.scheduled_at).toISOString().slice(0, 16)
            : ""
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [workspace, id]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/content/${id}?workspace=${workspace}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption,
        scheduled_at: scheduledAt || undefined,
      }),
    });
    if (!res.ok) {
      const { error: msg } = await res.json();
      setError(msg ?? "Ошибка сохранения");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Удалить публикацию? Это действие необратимо.")) return;
    setDeleting(true);
    await fetch(`/api/content?workspace=${workspace}&id=${id}`, {
      method: "DELETE",
    });
    router.push(`/${workspace}/content`);
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-white/40">
        <Loader2 className="w-4 h-4 animate-spin" />
        Загрузка…
      </div>
    );
  }

  if (!post) {
    return (
      <div className="p-6">
        <p className="text-muted">Публикация не найдена</p>
        <Link
          href={`/${workspace}/content`}
          className="text-lime-400 hover:underline text-sm mt-2 inline-block"
        >
          ← Назад к контенту
        </Link>
      </div>
    );
  }

  const canEdit = post.status === "draft" || post.status === "scheduled";

  return (
    <div className="p-6 max-w-4xl">
      {/* Back */}
      <Link
        href={`/${workspace}/content`}
        className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад к контенту
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: media preview */}
        <div className="lg:col-span-2 space-y-3">
          {post.media && post.media.length > 0 ? (
            <>
              <div className="bg-surface-2 border border-border rounded-xl overflow-hidden aspect-square">
                {post.media[mediaIdx]?.type === "video" ? (
                  <video
                    src={post.media[mediaIdx].url}
                    className="w-full h-full object-contain"
                    controls
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.media[mediaIdx]?.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Thumbnails */}
              {post.media.length > 1 && (
                <div className="flex gap-2">
                  {post.media.map((m, i) => (
                    <button
                      key={i}
                      onClick={() => setMediaIdx(i)}
                      className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors ${
                        i === mediaIdx ? "border-lime-500" : "border-transparent"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.thumbnail ?? m.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="bg-surface-2 border border-border rounded-xl aspect-square flex items-center justify-center">
              <p className="text-muted text-sm">Без медиафайла</p>
            </div>
          )}

          {/* Stats */}
          {post.stats && post.status === "published" && (
            <div className="bg-surface-2 border border-border rounded-xl p-4 grid grid-cols-2 gap-3">
              {[
                { icon: Eye, value: post.stats.views, label: "просмотров" },
                { icon: Heart, value: post.stats.likes, label: "лайков" },
                { icon: MessageSquare, value: post.stats.comments, label: "комментариев" },
                { icon: Share2, value: post.stats.shares, label: "поделились" },
              ]
                .filter(({ value }) => value !== undefined)
                .map(({ icon: Icon, value, label }) => (
                  <div key={label}>
                    <div className="flex items-center gap-1.5 text-white/40 text-xs mb-0.5">
                      <Icon className="w-3 h-3" />
                      {label}
                    </div>
                    <p className="text-white font-semibold text-lg">
                      {(value ?? 0).toLocaleString()}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Right: details & edit */}
        <div className="lg:col-span-3 space-y-4">
          {/* Status + meta */}
          <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {STATUS_ICONS[post.status] ?? null}
                <span
                  className={
                    post.status === "published"
                      ? "badge-published"
                      : post.status === "scheduled"
                      ? "badge-scheduled"
                      : post.status === "failed"
                      ? "badge-failed"
                      : "badge-draft"
                  }
                >
                  {statusLabel(post.status)}
                </span>
              </div>

              {post.status === "published" && post.media?.[0]?.url && (
                <a
                  href={post.media[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-white/40 hover:text-white text-xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Открыть
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted mb-0.5">Платформы</p>
                <p className="text-white">
                  {post.platforms?.map(platformLabel).join(", ") || "—"}
                </p>
              </div>
              <div>
                <p className="text-muted mb-0.5">Создан</p>
                <p className="text-white">{formatDate(post.created_at)}</p>
              </div>
              {post.scheduled_at && (
                <div>
                  <p className="text-muted mb-0.5">Запланирован</p>
                  <p className="text-white">{formatDate(post.scheduled_at)}</p>
                </div>
              )}
              {post.published_at && (
                <div>
                  <p className="text-muted mb-0.5">Опубликован</p>
                  <p className="text-white">{formatDate(post.published_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Caption editor */}
          <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-3">
            <h2 className="text-white font-medium text-sm">Текст</h2>
            {canEdit ? (
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={8}
                className="w-full bg-surface-4 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30 transition-colors resize-none"
              />
            ) : (
              <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                {post.caption || "Без подписи"}
              </p>
            )}
            <p className="text-muted text-xs text-right">{caption.length} симв.</p>
          </div>

          {/* Schedule editor */}
          {canEdit && (
            <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-3">
              <h2 className="text-white font-medium text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-white/40" />
                Время публикации
              </h2>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full bg-surface-4 border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-lime-500 transition-colors"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 text-red-400 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Удалить
            </button>

            {canEdit && (
              <>
                <div className="flex-1" />
                {saved && (
                  <span className="text-lime-400 text-sm flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Сохранено
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Сохранить
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
