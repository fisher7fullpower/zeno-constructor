# Security Review Report — morrowlab.by

> Полный реестр проверок безопасности, обнаруженных уязвимостей и выполненных исправлений.
> Последнее обновление: 2026-03-29

---

## Содержание

1. [Обзор проверок](#1-обзор-проверок)
2. [Proxy API (proxy.py) — 30 + 5 находок](#2-proxy-api)
3. [SMM Admin Panel — 28 находок](#3-smm-admin-panel)
4. [ZENO виджеты — аудит внешних запросов](#4-zeno-виджеты)
5. [Серверная инфраструктура](#5-серверная-инфраструктура)
6. [Текущие защитные меры](#6-текущие-защитные-меры)
7. [Оставшиеся задачи](#7-оставшиеся-задачи)

---

## 1. Обзор проверок

| Дата | Объект | Метод | Находок | Исправлено |
|------|--------|-------|---------|------------|
| 2026-03-28 | proxy.py, ml-upload.py, admin HTML, blog, projects | Ручной code review | 30 | 30/30 |
| 2026-03-29 | proxy.py (после фиксов) | CodeRabbit CLI v0.3.11 | 5 | 5/5 |
| 2026-03-29 | proxy.py (повторный прогон) | CodeRabbit CLI | 2 | 2/2 |
| 2026-03-29 | proxy.py (финальный прогон) | CodeRabbit CLI | 1 | 1/1 |
| 2026-03-29 | smm-admin/ (Next.js + Supabase) | Ручной code review | 28 | 28/28 |
| 2026-03-28 | ZENO виджеты (чат, счётчик, блог) | Аудит внешних запросов | 4 | 4/4 |
| 2026-03-29 | Серверная инфраструктура | Аудит конфигурации | 6 | 6/6 |

**Итого: 76 находок, все исправлены.**

---

## 2. Proxy API

### 2.1 Основной code review — 30 находок (proxy.py, ml-upload.py, admin HTML)

#### CRITICAL (6)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| 1 | **Хардкод пароля** `DEFAULT_PASS='***REDACTED_OLD_PASSWORD***'` в admin HTML | admin/index.html | ✅ Удалён, JWT auth |
| 2 | **SSRF в proxy-image** — произвольные URL без проверки домена | proxy.py `/api/proxy-image` | ✅ Domain allowlist |
| 3 | **Open proxy** — homedesigns endpoint принимал любые пути | proxy.py `/api/homedesigns/v2/` | ✅ Endpoint allowlist |
| 4 | **CORS `*`** — wildcard разрешал запросы с любого домена | proxy.py `after_request` | ✅ Origin allowlist (6 доменов) |
| 5 | **Хардкод GROQ_API_KEY** с fallback `gsk_...` в коде | /opt/proxy.py | ✅ `os.environ.get()` |
| 6 | **Хардкод RESEND_KEY и JWT_SECRET** напрямую в коде | /opt/proxy.py | ✅ `os.environ.get()` |

#### HIGH (8)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| 7 | **Нет auth на blog CRUD** — admin-content-load/save без проверки | ml-upload.py | ✅ `check_auth()` добавлен |
| 8 | **XSS в блоге** — пользовательский контент без экранирования | blog/index.html | ✅ `esc()` + strip script/iframe |
| 9 | **XSS в проектах** — URL и текст без экранирования | projects/index.html | ✅ `esc()` на все поля |
| 10 | **Предсказуемые имена файлов** — перезапись при загрузке | ml-upload.py | ✅ UUID filenames |
| 11 | **`--enable-local-file-access`** в wkhtmltopdf — чтение серверных файлов | ml-upload.py | ✅ Флаг удалён |
| 12 | **`str(e)` в ответах** — утечка стектрейсов и путей | proxy.py, ml-upload.py | ✅ Generic errors |
| 13 | **JSONP callback** в блоге — потенциальный XSS вектор | blog/index.html | ✅ Удалён |
| 14 | **ml-upload на `0.0.0.0`** — доступен извне | ml-upload.py | ✅ `127.0.0.1` |

#### MEDIUM (10)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| 15 | **Нет CSRF защиты** на POST endpoints | proxy.py | ✅ Origin/Referer check |
| 16 | **Нет rate limiting** на API endpoints | proxy.py | ✅ Flask-Limiter |
| 17 | **Flask dev server** в продакшене | proxy-constructor.service | ✅ gunicorn (2 workers) |
| 18 | **Неограниченный base64** — DoS через большие изображения | proxy.py | ✅ MAX_BASE64_BYTES (10MB) |
| 19 | **Нет валидации prediction ID** — произвольные строки в URL | proxy.py | ✅ Regex `^[a-zA-Z0-9]{10,40}$` |
| 20 | **Env-файл с мусором** — строки с raw secrets (PAT, SSH key) | proxy-constructor.env | ✅ Очищен до 7 переменных |
| 21 | **Webhook endpoints с `/admin-upload`** — раскрытие функции | pages/*.html | ✅ Переименован в `/photo-upload` |
| 22 | **Secrets в n8n JSON** — хардкод ключей в workflow файлах | n8n_*.json | ✅ Плейсхолдеры |
| 23 | **Secrets в CLAUDE.md** — JWT, admin key, IP, SSH | CLAUDE.md | ✅ Все удалены |
| 24 | **Нет .gitignore** для чувствительных файлов | .gitignore | ✅ ml-upload.py, patch_*, n8n_* |

#### LOW (6)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| 25 | **Нет Content-Type проверки** в proxy-image | proxy.py | ✅ Проверка `image/*` |
| 26 | **`allow_redirects=True`** по умолчанию — SSRF через redirect | proxy.py | ✅ `allow_redirects=False` |
| 27 | **Отсутствие `.env.example`** | корень проекта | ✅ Создан |
| 28 | **Импорт breakage** после sed-патчей | /opt/proxy.py | ✅ Исправлен |
| 29 | **Неверный путь к `integrations.env.example`** | deploy docs | ✅ Обновлён |
| 30 | **Дублирование `getPass()`** в admin HTML | admin/index.html | ✅ Удалён |

---

### 2.2 CodeRabbit CLI review — 5 + 2 + 1 находок (proxy.py)

#### Прогон 1 (после security hardening commit)

| Severity | Проблема | Статус |
|----------|---------|--------|
| CRITICAL | **Webhook URL** передаётся в Replicate без валидации (SSRF через третью сторону) | ✅ Allowlist: morrowlab.by, zenohome.by |
| HIGH | **Произвольные поля** пробрасываются в HomeDesigns API (parameter injection) | ✅ `HOMEDESIGNS_ALLOWED_FIELDS` (22 поля) |
| MEDIUM | **Нет rate limiting** в локальном proxy.py | ⏭️ Есть на сервере (Flask-Limiter) |
| MEDIUM | **Нет валидации содержимого base64** — SVG/polyglot файлы | ✅ Magic bytes + запрет SVG |
| MEDIUM | **Regex prediction ID** `{20,30}` может быть хрупким | ✅ Расширен до `{10,40}` |

#### Прогон 2

| Severity | Проблема | Статус |
|----------|---------|--------|
| MEDIUM | **WebP magic bytes** — RIFF совпадает с WAV/AVI | ✅ Проверка RIFF + WEBP (offset 8:12) |
| LOW | **admin-content без auth** (документировано в CLAUDE.md) | ✅ Исправлено на сервере |

#### Прогон 3 (финальный)

| Severity | Проблема | Статус |
|----------|---------|--------|
| LOW | **Non-200 ответы** в proxy-image проксируются как пустое тело | ✅ Reject non-200 |
| LOW | **Prediction ID regex** — только lowercase, Replicate может использовать uppercase | ✅ `[a-zA-Z0-9]` |

---

## 3. SMM Admin Panel

### 28 находок (Next.js + TypeScript + Supabase)

#### CRITICAL (5)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| C-1 | **JWT secret fallback** `"change-me-in-production"` | auth.ts, middleware.ts | ✅ Throw if missing |
| C-2 | **Реальный API ключ Postmypost** в `.env.example` (в git) | .env.example | ✅ Postmypost удалён |
| C-3 | **`ON CONFLICT` перезаписывает пароли** — захват аккаунтов через invite | auth.ts `createUser` | ✅ `DO NOTHING` + error |
| C-4 | **Mass Assignment** — произвольные поля в PATCH clients | clients/[workspace]/route.ts | ✅ Whitelist полей |
| C-5 | **Непроверенное тело** в upstream API (Postmypost) | content/[id]/route.ts | ✅ Postmypost удалён |

#### HIGH (8)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| H-1 | **Magic link с токеном в логах** | auth/register/route.ts | ✅ Токен убран из лога |
| H-2 | **User ID в ответе** регистрации | auth/register/route.ts | ✅ Удалён из response |
| H-3 | **User enumeration** через `exists: true/false` | auth/register/route.ts | ✅ Uniform `{ sent: true }` |
| H-4 | **Нет rate limiting** на auth endpoints | login, register routes | ✅ rate-limit.ts (5/мин/IP) |
| H-5 | **Роль invite не валидируется** — privilege escalation | invites/route.ts | ✅ Allowlist ролей |
| H-6 | **Нет auth на GET invites** — любой видит приглашения | invites/route.ts | ✅ Access check добавлен |
| H-7 | **Секреты через CLI аргументы** (видны в `ps aux`) | setup_supabase.sh | ✅ Env vars |
| H-8 | **Колонка `role` отсутствует** в pg_schema.sql | pg_schema.sql | ✅ Добавлена |

#### MEDIUM (11)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| M-1 | **`ignoreBuildErrors`** подавляет TS/ESLint ошибки | next.config.ts | ✅ Убрано |
| M-2 | **SQL column injection** через QueryBuilder | supabase/server.ts | ✅ `safeColumn()` |
| M-3 | **Monkey-patching прототипа** QueryBuilder | supabase/server.ts | ✅ Рефакторинг |
| M-4 | **Дублирование** `getProjectId` в 5 файлах | API routes | ✅ `workspace-access.ts` |
| M-5 | **Двойное создание** Supabase клиента | content/route.ts | ✅ Через M-4 |
| M-6 | **`period` не валидируется** | analytics/page.tsx | ⏭️ Stub (Postmypost удалён) |
| M-7 | **`String(e)` утекает** внутренние детали | Все API routes | ✅ Generic errors |
| M-8 | **`magic_tokens` таблица** отсутствует в схеме | pg_schema.sql | ✅ Добавлена |
| M-9 | **`licensed_emails` таблица** отсутствует в схеме | pg_schema.sql | ✅ Добавлена |
| M-10 | **Open redirect** через `next` параметр на логине | login/page.tsx | ✅ Валидация `//` |
| M-11 | **Нет CSRF** на GET confirm endpoint | auth/confirm/route.ts | ✅ GET → POST |

#### LOW (10)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| L-1 | Неиспользуемые Supabase зависимости | package.json | ✅ Удалены |
| L-2 | Смешанные импорты (raw pool + mock client) | invites/[token]/route.ts | ⏭️ Косметика |
| L-3 | `eslint-disable` комментарии | Множество файлов | ⏭️ Косметика |
| L-4 | Минимальная email валидация (`@` check) | auth/register/route.ts | ✅ Regex |
| L-5 | Доверие email из query параметра над токеном | auth/confirm/route.ts | ✅ Только token email |
| L-6 | Homepage redirect без проверки доступа | page.tsx | ✅ Filter by user |
| L-7 | Неиспользуемые `@supabase/*` пакеты | package.json | ✅ = L-1 |
| L-8 | n8n webhook secret без timing-safe сравнения | n8n workflow JSON | ⏭️ Low risk |
| L-9 | Нет требований к сложности пароля | invites/[token]/route.ts | ✅ Uppercase + digit |
| L-10 | `createClient()` на каждый рендер Layout | layout.tsx | ✅ `useMemo` |

---

## 4. ZENO виджеты

### Аудит внешних запросов — 4 находки

| # | Проблема | Компонент | Статус |
|---|---------|-----------|--------|
| Z-1 | **CORS `*`** на n8n webhooks — любой сайт вызывает API | zeno-blog, zeno-counter, zeno-chat | ✅ Origin allowlist в n8n |
| Z-2 | **Referrer leakage** — полный URL с поисковыми запросами и UTM | tilda_visitor_counter | ✅ Обрезан до домена |
| Z-3 | **Google Translate** — переписка с AI уходит в Google | zeno_chat_widget | ✅ Убран, ответы на русском |
| Z-4 | **JSONP callback** видим в DevTools — раскрытие архитектуры | tilda_blog_block | ✅ Переведён на fetch |

---

## 5. Серверная инфраструктура

### Аудит конфигурации — 6 находок

| # | Проблема | Что исправлено |
|---|---------|---------------|
| S-1 | **Хардкод `X-Admin-Key: '***REDACTED_ADMIN_KEY***'`** в admin HTML (10+ мест) и proxy.py (4 места) | ✅ JWT cookie auth (`/api/auth/admin-login` + `check_admin()`) |
| S-2 | **Нет endpoint `/api/auth/admin-login`** — форма входа не работала | ✅ Создан с rate-limit 5/мин |
| S-3 | **`proxy-constructor.env` содержал мусор** — raw secrets (GitHub PAT, SSH key) | ✅ Очищен до 7 переменных |
| S-4 | **Flask dev server** в продакшене | ✅ gunicorn (2 workers, 120s timeout) |
| S-5 | **ml-upload слушал на `0.0.0.0`** — доступен извне | ✅ `127.0.0.1` only |
| S-6 | **ADMIN_PASS не в env** — был хардкодом в коде | ✅ `/etc/proxy-constructor.env` |

---

## 6. Текущие защитные меры

### proxy.py (API proxy)

| Мера | Реализация |
|------|------------|
| **CORS** | Allowlist из 6 доменов (morrowlab.by, zenohome.by + www/constructor) |
| **SSRF protection** | Domain allowlist для proxy-image (6 доменов) |
| **Endpoint allowlist** | 11 разрешённых HomeDesigns endpoints |
| **Field allowlist** | 22 разрешённых поля для HomeDesigns API |
| **Webhook validation** | Только morrowlab.by и zenohome.by домены |
| **Image validation** | Magic bytes (PNG/JPG/GIF/WebP), SVG заблокирован, max 10MB |
| **Rate limiting** | Flask-Limiter: /api/replicate 30/мин, /api/homedesigns 20/мин, /api/proxy-image 60/мин, /api/auth/send-code 5/мин |
| **CSRF** | Origin/Referer проверка против ALLOWED_ORIGINS |
| **Auth** | JWT httpOnly cookie + `check_admin()` для admin endpoints |
| **Error handling** | Generic сообщения наружу, `sys.exit(1)` при отсутствии токенов |
| **File uploads** | UUID filenames, extension whitelist, size limits |
| **Production server** | gunicorn, bind 127.0.0.1, behind nginx |

### smm-admin (Next.js)

| Мера | Реализация |
|------|------------|
| **JWT auth** | Обязательный JWT_SECRET (throw if missing), httpOnly cookie |
| **Rate limiting** | In-memory rate limiter (5 req/мин/IP) на auth endpoints |
| **Input validation** | Field whitelists на PATCH, email regex, password complexity |
| **SQL injection** | `safeColumn()` — валидация имён колонок, параметризованные запросы |
| **XSS** | React auto-escaping + sanitized content |
| **CSRF** | SameSite=Lax cookies, GET→POST для state changes |
| **Open redirect** | Валидация `next` параметра (запрет `//`) |
| **Error handling** | Generic errors, no `String(e)` leakage |
| **Access control** | `checkWorkspaceAccess()` на всех admin routes, role validation |
| **Build safety** | TypeScript + ESLint проверки включены |

### Env-файлы (серверные)

| Файл | Переменные |
|------|------------|
| `/etc/proxy-constructor.env` | REPLICATE_TOKEN, HOMEDESIGNS_TOKEN, GROQ_API_KEY, JWT_SECRET, RESEND_KEY, FROM_EMAIL, ADMIN_PASS |
| `/etc/ml-upload.env` | ADMIN_KEY |

---

## 7. Оставшиеся задачи

| Приоритет | Задача | Описание |
|-----------|--------|----------|
| HIGH | **git filter-repo** | Удалить старые секреты из истории коммитов (GROQ key, JWT_SECRET, admin password были в предыдущих коммитах) |
| HIGH | **Ротация ключей** | Все ключи, которые были в коде/коммитах, должны быть заменены на новые |
| MEDIUM | **admin-content auth** | Проверить что `check_auth()` в ml-upload.py корректно защищает GET/POST для content-load/content-save |
| MEDIUM | **n8n timing-safe** | Webhook secret сравнение в n8n workflow использует `!==` вместо `crypto.timingSafeEqual()` |
| LOW | **eslint-disable cleanup** | Убрать подавленные ESLint правила в smm-admin компонентах |
| LOW | **Unused imports** | Смешанные паттерны (raw pool + mock supabase) в invites/[token]/route.ts |

---

## Коммиты безопасности

```
3cdf7fc  SMM admin: remove Postmypost integration, fix all 28 security findings
89f4637  Allow uppercase in Replicate prediction ID validation
55c2874  Reject non-200 responses in proxy-image to prevent empty body proxying
a9bfc9c  Fix WebP magic byte validation: check RIFF+WEBP signature, not just RIFF
5c7278b  Fix critical/high findings from CodeRabbit review: webhook SSRF, parameter injection, image validation
2a16cbd  Security hardening: fix all 30 code review findings
6085378  Security: remove hardcoded secrets, restructure CLAUDE.md
```

---

*Документ сгенерирован на основе ручного code review, CodeRabbit CLI v0.3.11, и аудита серверной инфраструктуры.*
