# Technical Reference — Morrow Lab

## Сервисы и порты

| Сервис | Команда | Порт | Назначение |
|--------|---------|------|-----------|
| proxy-constructor | `systemctl restart proxy-constructor` | 3030 | Flask API (основной) |
| ml-upload | `systemctl restart ml-upload` | 3001 | Uploads, analytics, blog |
| nginx | `systemctl restart nginx` | 443/80 | Reverse proxy, SSL |
| n8n | Docker | 5678 | Workflow automation |
| PostgreSQL | — | 5432 | Analytics, tokens, blog |

## Env-файлы

| Файл | Переменные |
|------|-----------|
| `/etc/proxy-constructor.env` | REPLICATE_TOKEN, DECOR8_TOKEN, GROQ_API_KEY, RESEND_KEY, FROM_EMAIL, JWT_SECRET |
| `/etc/ml-upload.env` | ADMIN_KEY |

## Deploy

```bash
# Деплой файла
scp <file> root@<SERVER>:/var/www/morrowlab.by/html/<path>

# Перезапуск
systemctl restart proxy-constructor ml-upload nginx

# Логи
journalctl -u proxy-constructor -f
journalctl -u ml-upload -f
```

## Nginx routing

```
/api/*               → proxy.py :3030
/webhook/photo-upload → ml-upload.py :3001
/webhook/save-render  → ml-upload.py :3001
/webhook/track-event  → ml-upload.py :3001
/webhook/morrow-*     → ml-upload.py :3001
/webhook/admin-*      → ml-upload.py :3001
/webhook/*            → n8n :5678 (catch-all)
/images/renders/      → static, no-cache
/uploads/requests/    → static (вложения)
```

## База данных PostgreSQL

| Таблица | Назначение |
|---------|-----------|
| `ml_events` | Аналитические события |
| `ml_visits` | Визиты |
| `ml_users` | Пользователи + токены |
| `blog_topics` | Статьи блога |

## Auth модель

- **Заявки:** `user_token` / `partner_token` в URL — «ссылка = доступ»
- **Кабинеты:** OTP → JWT httpOnly cookie (30 дней)
- **Админка:** JWT (отдельный flow через n8n)
- **API:** X-Admin-Key header для внутренних endpoints

## Rate Limits (proxy.py)

| Endpoint | Лимит |
|---------|-------|
| `/api/request` (POST) | 5/day per IP |
| `/api/replicate` | 10/min per IP |
| `/api/decor8/*` | 20/min per IP |
| `/api/auth/send-code` | 5/hour per IP |

## AI-сервисы

| Сервис | Назначение | Модель |
|--------|-----------|--------|
| Groq | LLM chat, moodboard | llama-3.1-8b / mixtral |
| Decor8.ai | Interior renders (51 стиль, 29 типов комнат) | proprietary |
| Replicate | Upscale, FLUX | real-esrgan, flux |
| GPTunnel | Backup LLM | gpt-4o через прокси |

## JSON storage

```
data/partners.json          — список партнёров
data/requests/<id>.json     — заявки (по файлу на заявку)
data/utm_clicks.json        — UTM-клики
images/uploads/             — фото пользователей
images/renders/             — AI-рендеры
uploads/requests/<rid>/     — вложения к заявкам
```
