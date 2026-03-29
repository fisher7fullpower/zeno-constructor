# SMM Admin — Деплой на smm.morrowlab.by

## Архитектура

```
smm.morrowlab.by  → Vercel (Next.js 15)
                       │
          ┌────────────┼───────────────┐
          ▼            ▼
     Supabase     n8n.zenohome.by
  (Auth + DB)   /webhook/smm-*
```

---

## Шаг 1 — Supabase

1. Зайти на https://supabase.com → **New project**
2. Название: `smm-morrowlab` · Регион: Frankfurt
3. Зайти в **SQL Editor** → выполнить `supabase_schema.sql`
4. Зайти в **Settings → API** → скопировать:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Шаг 2 — Первый пользователь в Supabase

В Supabase → **Authentication → Users → Invite user**:
- Email: твой рабочий email
- После первого входа он получит роль owner

Или через SQL:
```sql
-- После регистрации через email — получить user_id из auth.users
-- Потом создать запись client_users с role='owner'
```

---

## Шаг 3 — DNS (на хостинге morrowlab.by)

Добавить запись:
```
Тип:  CNAME
Имя:  smm
Цель: cname.vercel-dns.com
TTL:  3600
```

---

## Шаг 4 — Vercel

```bash
# Установить Vercel CLI (на своей машине с Node.js)
npm i -g vercel

# Из папки smm-admin
cd smm-admin
vercel

# Привязать домен
vercel domains add smm.morrowlab.by
```

В Vercel Dashboard → Project → Settings → **Environment Variables**:

| Переменная | Значение |
|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | https://xxx.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | eyJ... |
| `SUPABASE_SERVICE_ROLE_KEY` | eyJ... |
| `N8N_BASE_URL` | https://n8n.zenohome.by |
| `N8N_WEBHOOK_SECRET` | придумай_случайную_строку |
| `NEXT_PUBLIC_APP_URL` | https://smm.morrowlab.by |

---

## Шаг 5 — n8n: создать SMM webhook

В n8n.zenohome.by создать новый Workflow **"SMM Generate Post"**:

```
1. [Webhook] POST /smm-generate
   - Validate header X-SMM-Secret
   
2. [HTTP Request] GPTunnel / OpenAI
   - Generate: caption, hashtags, video_prompt
   
3. [HTTP Request] HomeDesigns.ai
   - Generate design image
   
4. [IF] type == video
   └── [HTTP Request] Replicate SVD
       - Image → Video
       └── [Wait + Poll] 
   
5. [Respond] 200 OK
   → { media_url, media_type, caption, hashtags }
```

Webhook endpoint будет: `https://n8n.zenohome.by/webhook/smm-generate`

---

## Шаг 6 — Первый запуск (проверка)

1. Открыть https://smm.morrowlab.by
2. Войти (email + пароль из Supabase)
3. Создать первого клиента
4. Подключить Instagram / TikTok аккаунт
5. Создать тестовый пост вручную

---

## Альтернатива: деплой на свой сервер (без Vercel)

Если нужно на сервер morrowlab.by:

```bash
# На сервере
git clone ... /opt/smm-admin
cd /opt/smm-admin
npm install
npm run build

# Запустить через PM2
npm install -g pm2
pm2 start npm --name smm-admin -- start
pm2 save

# Nginx конфиг
```

```nginx
server {
    listen 80;
    server_name smm.morrowlab.by;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# SSL
certbot --nginx -d smm.morrowlab.by
```

---

## Структура файлов

```
smm-admin/
├── src/
│   ├── app/
│   │   ├── (auth)/login/        ← страница входа
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx       ← sidebar + auth guard
│   │   │   ├── clients/         ← список клиентов
│   │   │   └── [workspace]/     ← рабочее пространство клиента
│   │   │       ├── page.tsx     ← дашборд
│   │   │       ├── content/     ← публикации
│   │   │       ├── accounts/    ← соцсети
│   │   │       ├── trends/      ← тренды
│   │   │       ├── analytics/   ← аналитика
│   │   │       └── settings/    ← настройки
│   │   └── api/                 ← API routes
│   ├── lib/
│   │   ├── n8n.ts               ← n8n webhook client
│   │   └── supabase/            ← Supabase clients
│   └── middleware.ts            ← auth guard
├── .env.local                   ← секреты (не в git!)
└── .env.example                 ← шаблон
```
