# SMM Admin — Morrow Lab

Админ-панель для управления SMM-публикациями.  
Домен: **smm.morrowlab.by**

## Стек

| Слой | Технология |
|------|-----------|
| Frontend + API | Next.js 15 (App Router, TypeScript) |
| Auth + DB | Supabase |
| Стили | Tailwind CSS v3 (dark theme, lime brand) |
| AI-генерация | n8n webhook → GPTunnel + HomeDesigns.ai + Replicate |

## Документация

- [Архитектура: видео для поста из изображения + сценарий](docs/ARCHITECTURE_VIDEO_POST_PIPELINE.md) — I2V, любой стартовый кадр, звук, контракт webhook, фазы внедрения.
- [n8n: workflow «только скачивание» видео](docs/N8N_VIDEO_DOWNLOAD_WORKFLOW.md) — импорт `n8n_video_download_workflow.json`, webhook `smm-video-download`, без обязательного постинга.

## Быстрый старт

### 1. Клонировать / открыть

```bash
cd smm-admin
```

### 2. Установить зависимости

```bash
npm install
```

### 3. Настроить переменные окружения

```bash
cp .env.example .env.local
```

Открыть `.env.local` и заполнить:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

N8N_BASE_URL=https://n8n.zenohome.by
N8N_WEBHOOK_SECRET=придумай_строку

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Создать БД в Supabase

В Supabase → SQL Editor выполнить `supabase_schema.sql`

### 5. Запустить локально

```bash
npm run dev
# → http://localhost:3000
```

### 6. Деплой на Vercel

```bash
npx vercel
vercel domains add smm.morrowlab.by
```

Добавить env-переменные в Vercel Dashboard → Settings → Environment Variables.

---

## n8n Workflow

Импортировать `n8n_smm_generate_workflow.json` в n8n.zenohome.by:

1. Открыть https://n8n.zenohome.by
2. New Workflow → Import from File
3. Загрузить `n8n_smm_generate_workflow.json`
4. Добавить переменную окружения `SMM_WEBHOOK_SECRET` в n8n (Settings → Variables или docker-compose env)
5. Активировать workflow

---

## Структура страниц

```
/login                          — вход
/invite/[token]                 — принятие приглашения

/clients                        — список клиентов (Owner)
/clients/new                    — создать клиента

/[workspace]                    — дашборд клиента
/[workspace]/content            — публикации (список / сетка)
/[workspace]/content/new        — создать пост (вручную / AI)
/[workspace]/content/[id]       — просмотр / редактирование поста
/[workspace]/accounts           — подключённые соцсети
/[workspace]/trends             — тренды TikTok / Instagram
/[workspace]/analytics          — аналитика
/[workspace]/settings           — настройки клиента
```

## Роли

| Роль | Может |
|------|-------|
| **owner** | Всё: создавать клиентов, приглашать, управлять |
| **operator** | Создавать посты, редактировать, публиковать |
| **client** | Только просмотр своих постов и аналитики |

## Файловая структура

```
src/
├── app/
│   ├── (dashboard)/         — защищённые страницы
│   │   ├── layout.tsx       — sidebar + auth guard
│   │   ├── clients/         — управление клиентами
│   │   └── [workspace]/     — рабочее пространство
│   ├── api/                 — API routes
│   │   ├── clients/         — CRUD клиентов
│   │   ├── content/         — публикации
│   │   ├── accounts/        — соцсети
│   │   ├── invites/         — приглашения
│   │   └── generate/        — AI-генерация ↔ n8n
│   ├── login/               — страница входа
│   └── invite/[token]/      — принятие приглашения
├── components/layout/
│   └── Sidebar.tsx
├── lib/
│   ├── n8n.ts               — n8n webhook client
│   └── supabase/            — Supabase clients + типы
└── middleware.ts             — auth guard
```
