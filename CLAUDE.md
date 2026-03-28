# Morrow Lab — CLAUDE.md

> AI-платформа дизайна интерьеров. Беларусь, Минск. morrowlab.by

---

## Guardrails

1. **НИКОГДА не коммить секреты.** Все ключи — в env-переменных на сервере (`/etc/proxy-constructor.env`, `/etc/ml-upload.env`). Не добавлять токены, пароли, IP-адреса в код, документацию или fallback-значения `os.environ.get()`.
2. **Навигация одинаковая на ВСЕХ страницах.** При изменении header/footer — менять на каждой из 23 страниц (список ниже в секции «Фронтенд»).
3. **Все страницы — single-file HTML** (CSS + JS inline). Нет сборщиков, нет npm.
4. **Тёмная тема** с lime `#d1fe17` акцентом. Шрифт Inter. Не менять цветовую схему.
5. **JSON storage** для заявок/партнёров (без ORM, без миграций). PostgreSQL только для аналитики, токенов и блога.
6. **Email через Resend API** — не SMTP.
7. **AI:** Groq (LLM) + HomeDesigns.ai (рендеры) + Replicate (upscale, FLUX).
8. **Не добавлять npm-зависимости.** Всё работает на чистом HTML/JS/CSS.
9. **Не менять auth модель** — «ссылка = доступ» (user_token / partner_token в URL). Кабинеты используют OTP → JWT.
10. **Не добавлять CORS-заголовки** без явной необходимости.

---

## Сборка и деплой

Сборки нет. Файлы деплоятся напрямую на сервер через `scp` или ручное копирование.

```bash
# Деплой файла на сервер
scp proxy.py root@<SERVER>:/opt/proxy.py

# Перезапуск сервисов (на сервере)
systemctl restart proxy-constructor   # Flask API
systemctl restart ml-upload           # Upload handler
systemctl restart nginx

# Логи
journalctl -u proxy-constructor -f
journalctl -u ml-upload -f
```

### Env-файлы на сервере

| Файл | Сервис | Переменные |
|------|--------|-----------|
| `/etc/proxy-constructor.env` | proxy-constructor | REPLICATE_TOKEN, HOMEDESIGNS_TOKEN, GROQ_API_KEY, RESEND_KEY, FROM_EMAIL, JWT_SECRET |
| `/etc/ml-upload.env` | ml-upload | ADMIN_KEY |

Systemd загружает env через `EnvironmentFile=` в unit-файлах.

---

## Локальная разработка

Бэкенд можно запустить локально для отладки, но полноценно работает только на сервере (доступ к PostgreSQL, файловой системе, nginx).

```bash
# Python 3.12+
# Зависимости: Flask, requests, PyJWT

# Запуск proxy.py локально (нужны env-переменные)
export REPLICATE_TOKEN=... HOMEDESIGNS_TOKEN=... GROQ_API_KEY=... RESEND_KEY=... JWT_SECRET=...
python3 proxy.py  # :3030

# Фронтенд — просто открыть HTML в браузере или через live-server
```

Фронтенд не требует сборки — HTML-файлы открываются напрямую. API-запросы идут на `morrowlab.by`, поэтому для тестирования фронтенда нужен работающий сервер.

---

## Тестирование

Автотестов нет. Проверка — ручная:

```bash
# 1. Проверить что proxy.py запустился
curl http://127.0.0.1:3030/api/partners  # → JSON массив партнёров

# 2. Проверить ml-upload.py
curl http://127.0.0.1:3001/webhook/morrow-check-tokens?email=test@test.com  # → {"ok": true}

# 3. Проверить что сервисы активны
systemctl is-active proxy-constructor ml-upload nginx

# 4. После изменения header/footer — визуально проверить 3-5 страниц
# 5. После изменения API — протестировать endpoint через curl или браузер
```

---

## Архитектура

```
Пользователь → nginx (443 SSL) → proxy.py (Flask API)
                                       ├── Replicate API (AI renders)
                                       ├── HomeDesigns.ai (interior design)
                                       ├── Groq API (LLM chat)
                                       ├── Resend (email)
                                       └── JSON files (data/)
                                 → ml-upload.py (Webhook handler)
                                       ├── PostgreSQL (analytics, tokens, blog)
                                       └── wkhtmltopdf (PDF)
                                 → n8n (Docker, workflow automation)
```

### Домены

| Домен | Назначение |
|-------|-----------|
| `morrowlab.by` | Основной сайт |
| `constructor.morrowlab.by` | Конструктор планировок (Konva.js) |
| `n8n.morrowlab.by` | n8n workflow UI |

---

## Ключевые файлы

### Бэкенд

| Файл | Фреймворк | Назначение |
|------|-----------|-----------|
| `proxy.py` | Flask | Основной API (рендеры, заявки, auth, email) |
| `ml-upload.py` | http.server | Uploads, analytics, blog CRUD |

### Фронтенд (23 страницы с навигацией)

При изменении header/footer менять **все** файлы:

| Путь | Назначение |
|------|-----------|
| `index.html` | Главная лендинг |
| `room/` | AI-рендеринг комнат |
| `kitchen/` | AI-рендеринг кухонь |
| `sanuzel/` | AI-рендеринг санузлов |
| `business/` | AI-рендеринг коммерческих |
| `dom/` | AI-рендеринг домов |
| `estimate/` | Сравнить цены (форма заявки) |
| `project/` | Дизайн Студия |
| `moodboard/` | AI Мудборд |
| `r/` | Статус заявки (доступ по токену) |
| `my/` | Кабинет пользователя (OTP) |
| `partner/reply/` | Ответ партнёра на заявку |
| `partner/dashboard/` | Кабинет партнёра (OTP) |
| `admin/` | Админ CMS |
| `blog/` | Блог |
| `masters/` | Мастера |
| `b2b/` | B2B |
| `about/` | О компании |
| `about/examples/` | Примеры работ |
| `privacy/` | Политика конфиденциальности |
| `oferta/` | Оферта |
| `constructor/` | Конструктор планировок |
| `projects/` | Проекты |

### Данные

| Путь | Назначение |
|------|-----------|
| `data/partners.json` | Список партнёров |
| `data/requests/<id>.json` | Заявки (по файлу на заявку) |
| `data/utm_clicks.json` | UTM-клики |
| `images/uploads/` | Фото пользователей для рендеринга |
| `images/renders/` | AI-рендеры (no-cache, auto-expire) |
| `uploads/requests/<rid>/` | Вложения к заявкам |

---

## API Endpoints (proxy.py)

### AI / Рендеринг

| Метод | Route | Auth | Назначение |
|-------|-------|------|-----------|
| POST | `/api/replicate` | — | Replicate prediction (base64→URL) |
| GET | `/api/replicate/<id>` | — | Статус prediction |
| POST | `/api/homedesigns/v2/<endpoint>` | — | Прокси к HomeDesigns.ai |
| POST | `/api/homedesigns/advisor` | — | AI-дизайн консультант |
| POST | `/api/upscale` | — | Real-ESRGAN upscale |
| GET | `/api/proxy-image` | — | CORS proxy для внешних изображений |
| POST | `/api/moodboard` | — | Анализ стиля через Groq |
| POST | `/api/consultant` | — | AI консультант по ремонту |

### Заявки

| Метод | Route | Auth | Назначение |
|-------|-------|------|-----------|
| GET | `/api/partners` | — | Список активных партнёров |
| POST | `/api/request` | — | Создать заявку (rate limit: 5/day) |
| GET | `/api/request/<rid>` | user_token | Статус заявки |
| POST | `/api/request/<rid>/reply` | partner_token | Ответ партнёра |
| POST | `/api/request/<rid>/choose` | user_token | Выбор партнёра |
| GET | `/api/request/<rid>/view` | partner_token | Просмотр заявки |
| POST | `/api/request/<rid>/upload` | user_token | Загрузка файла (max 5MB) |
| POST | `/api/request/<rid>/attach` | user_token | Добавить ссылку |
| POST | `/api/request/<rid>/detach` | user_token | Удалить вложение |

### OTP авторизация

| Метод | Route | Auth | Назначение |
|-------|-------|------|-----------|
| POST | `/api/auth/send-code` | — | Отправить OTP на email |
| POST | `/api/auth/verify-code` | — | Проверить код → JWT cookie (30 дней) |
| POST | `/api/auth/logout` | — | Удалить cookie |
| GET | `/api/auth/me` | JWT cookie | Проверить авторизацию |
| GET | `/api/my/requests` | JWT cookie | Заявки пользователя |
| GET | `/api/partner/requests` | JWT cookie | Заявки партнёра |

### Админка

| Метод | Route | Auth | Назначение |
|-------|-------|------|-----------|
| GET | `/api/admin/utm-analytics` | admin (JWT) | UTM-аналитика |
| GET | `/api/admin/requests` | admin (JWT) | Все заявки |
| GET/POST | `/api/admin/partners` | admin (JWT) | Управление партнёрами |

## API Endpoints (ml-upload.py)

| Route | Auth | Назначение |
|-------|------|-----------|
| `POST /webhook/photo-upload` | — | Публичная загрузка фото (max 10MB) |
| `POST /webhook/admin-upload` | X-Admin-Key | Админ-загрузка (max 15MB) |
| `POST /webhook/save-render` | — | Скачивание рендера с URL |
| `POST /webhook/save-report` | X-Admin-Key | HTML отчёт |
| `POST /webhook/html-to-pdf` | X-Admin-Key | HTML → PDF конвертация |
| `POST /webhook/track-event` | — | Аналитическое событие → PostgreSQL |
| `POST /webhook/morrow-support` | — | AI-чат поддержки |
| `POST /webhook/morrow-check-tokens` | — | Токены пользователя |
| `GET/POST /webhook/admin-content-*` | **нет (TODO)** | Блог CRUD — требует добавления auth |
| `POST /admin/diagnose` | X-Admin-Key | Диагностика системы |
| `POST /admin/restart` | X-Admin-Key | Перезапуск сервиса |

> **TODO:** Эндпоинты `admin-content-load` и `admin-content-save` не проверяют X-Admin-Key. Нужно добавить `check_auth()` перед обработкой.

---

## n8n Workflows

n8n работает в Docker на порту 5678. Webhook-ы проксируются через nginx (`/webhook/*` catch-all).

| Воркфлоу | Назначение |
|----------|-----------|
| Morrow Lab | Основной — обработка заявок, email, рендеринг |
| Morrow Project — AI Design Project | Генерация дизайн-проектов, PDF |
| Morrow Support Agent — Groq + AutoFix | AI-поддержка + диагностика сервера |
| AI Дизайн Студия — Studio Process | Обработка заказов студии |
| Admin Auth | Авторизация админки |
| Admin Renders Load | Загрузка рендеров в админку |
| Morrow Lab/DEV | Тестовая копия основного воркфлоу |

Credentials в n8n (обновлять при ротации ключей):
- **Header Auth account** — Replicate Token (формат: `Token r8_...`)
- **GPTUNNEL API** — Header Auth (формат: ключ GPTunnel)
- **Groq API Key** — Header Auth (формат: `Bearer gsk_...`)
- **Bearer Auth account 2** — Resend Token (формат: `re_...`)
- **Postmypost API** — Header Auth

---

## Дизайн-система

```css
--lime: #d1fe17;               /* Акцентный */
--bg: #000;                     /* Фон */
--card: #0a0a0a;               /* Карточка */
--border: #1c1c1c;             /* Бордер */
--gray: #666;                  /* Серый текст */
--muted: rgba(255,255,255,0.45);
```

- Шрифт: `Inter` (Google Fonts), weights 300-800
- Кнопки: `.btn-lime` (основная CTA), `.btn-ghost` (прозрачная), `.btn-outline`
- Breakpoint мобильного меню: `<860px`

---

## Система заявок — поток

```
Пользователь → /estimate/ → форма (помещение, бюджет, email) → выбирает партнёров
  → POST /api/request → JSON в data/requests/ → email партнёрам
Партнёр → email → /partner/reply/ → вводит цену, описание, смету
  → POST /api/request/<rid>/reply → email пользователю
Пользователь → /r/ → видит ответы → выбирает → POST /api/request/<rid>/choose
```

Auth модель: **"ссылка = доступ"** — user_token и partner_token в URL.
Кабинеты `/my/` и `/partner/dashboard/` используют OTP → JWT httpOnly cookie.

---

## Nginx routing

```
/api/*                    → proxy (proxy.py)
/webhook/photo-upload     → proxy (ml-upload.py)
/webhook/admin-upload     → proxy (ml-upload.py)
/webhook/save-render      → proxy (ml-upload.py)
/webhook/save-report      → proxy (ml-upload.py)
/webhook/track-event      → proxy (ml-upload.py)
/webhook/morrow-*         → proxy (ml-upload.py)
/webhook/admin-*          → proxy (ml-upload.py)
/webhook/*                → proxy (n8n, catch-all)
/uploads/requests/        → static (вложения заявок)
/images/renders/          → static, no-cache
```

---

## База данных PostgreSQL

| Таблица | Назначение |
|---------|-----------|
| `ml_events` | Аналитические события |
| `ml_visits` | Визиты |
| `ml_users` | Пользователи + токены рендеринга |
| `blog_topics` | Статьи блога |
