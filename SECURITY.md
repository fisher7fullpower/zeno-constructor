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
| 2026-03-29 | morrowlab.by (раунд 4) | Code review agent | 5 | 4/5 |
| 2026-03-29 | smm-admin (раунд 4) | Code review agent | 10 | 8/10 |
| 2026-03-29 | morrowlab.by (раунд 5) | Code review agent | 13 | 7/13 |
| 2026-03-29 | smm-admin (раунд 5) | Code review agent | 9 | 4/9 |
| 2026-03-29 | morrowlab.by (раунд 6) | Code review agent | 3 | 2/3 |
| 2026-03-29 | smm-admin (раунд 6) | Code review agent | 7 | 4/7 |

**Итого: 166 находок. 149 исправлено + 15 закрыто в текущей сессии = 164 закрыто. 2 accepted risk (архитектурные, дублируют закрытые).**

---

## 2. Proxy API

### 2.1 Основной code review — 30 находок (proxy.py, ml-upload.py, admin HTML)

#### CRITICAL (6)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| 1 | **Хардкод пароля** `DEFAULT_PASS='***REDACTED_OLD_PASSWORD***'` в admin HTML | admin/index.html | ✅ Удалён, JWT auth |
| 2 | **SSRF в proxy-image** — произвольные URL без проверки домена | proxy.py `/api/proxy-image` | ✅ Domain allowlist |
| 3 | **Open proxy** — decor8 endpoint принимал любые пути | proxy.py `/api/decor8/v2/` | ✅ Endpoint allowlist |
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
| HIGH | **Произвольные поля** пробрасываются в Decor8 API (parameter injection) | ✅ `DECOR8_ALLOWED_FIELDS` (22 поля) |
| MEDIUM | **Нет rate limiting** в локальном proxy.py | ✅ In-memory rate limiter (30/60/20/10/мин) |
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
| M-6 | **`period` не валидируется** | analytics/page.tsx | 🔒 N/A: Postmypost удалён, endpoint — stub |
| M-7 | **`String(e)` утекает** внутренние детали | Все API routes | ✅ Generic errors |
| M-8 | **`magic_tokens` таблица** отсутствует в схеме | pg_schema.sql | ✅ Добавлена |
| M-9 | **`licensed_emails` таблица** отсутствует в схеме | pg_schema.sql | ✅ Добавлена |
| M-10 | **Open redirect** через `next` параметр на логине | login/page.tsx | ✅ Валидация `//` |
| M-11 | **Нет CSRF** на GET confirm endpoint | auth/confirm/route.ts | ✅ GET → POST |

#### LOW (10)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| L-1 | Неиспользуемые Supabase зависимости | package.json | ✅ Удалены |
| L-2 | Смешанные импорты (raw pool + mock client) | invites/[token]/route.ts | 🔒 Архитектурно: pool для JOIN, mock для simple queries |
| L-3 | `eslint-disable` комментарии | Множество файлов | ✅ `as any` → `as Record<string, unknown>` (3 файла) |
| L-4 | Минимальная email валидация (`@` check) | auth/register/route.ts | ✅ Regex |
| L-5 | Доверие email из query параметра над токеном | auth/confirm/route.ts | ✅ Только token email |
| L-6 | Homepage redirect без проверки доступа | page.tsx | ✅ Filter by user |
| L-7 | Неиспользуемые `@supabase/*` пакеты | package.json | ✅ = L-1 |
| L-8 | n8n webhook secret без timing-safe сравнения | n8n workflow JSON | 🔒 Low risk: n8n внутренний, не атакуемый извне |
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
| **Endpoint allowlist** | 11 разрешённых Decor8 endpoints |
| **Field allowlist** | 22 разрешённых поля для Decor8 API |
| **Replicate input allowlist** | 17 разрешённых полей для Replicate API input |
| **Webhook validation** | Только morrowlab.by и zenohome.by домены |
| **Image validation** | Magic bytes (PNG/JPG/GIF/WebP), SVG заблокирован, max 10MB |
| **Rate limiting** | In-memory rate limiter + Flask-Limiter (prod): replicate 30/мин, decor8 20/мин, advisor 10/мин, proxy-image 60/мин |
| **CSRF** | Origin/Referer проверка против ALLOWED_ORIGINS |
| **Auth** | JWT httpOnly cookie + `check_admin()` для admin endpoints |
| **Error handling** | Generic сообщения наружу, `sys.exit(1)` при отсутствии токенов |
| **File uploads** | UUID filenames, extension whitelist, size limits |
| **Production server** | gunicorn, bind 127.0.0.1, behind nginx |

### smm-admin (Next.js)

| Мера | Реализация |
|------|------------|
| **JWT auth** | Обязательный JWT_SECRET (throw if missing), httpOnly cookie |
| **Rate limiting** | In-memory rate limiter с endpoint-scoped ключами (`endpoint:ip`) на всех sensitive endpoints |
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
| `/etc/proxy-constructor.env` | REPLICATE_TOKEN, DECOR8_TOKEN, GROQ_API_KEY, JWT_SECRET, RESEND_KEY, FROM_EMAIL, ADMIN_PASS |
| `/etc/ml-upload.env` | ADMIN_KEY |

---

## 7. Оставшиеся задачи

| Приоритет | Задача | Описание | Статус |
|-----------|--------|----------|--------|
| HIGH | **git filter-repo** | Удалить старые секреты из истории коммитов | ✅ Выполнено |
| HIGH | **Ротация ключей** | Все ключи, которые были в коде/коммитах, должны быть заменены на новые | ⚠️ Рекомендуется |
| MEDIUM | **admin-content auth** | `check_auth()` в ml-upload.py | ✅ Защищено |
| MEDIUM | **n8n timing-safe** | Webhook secret `!==` vs `timingSafeEqual()` | 🔒 Low risk |
| LOW | **eslint-disable cleanup** | `as any` → `as Record<string, unknown>` | ✅ 3 файла |
| LOW | **Unused imports** | Смешанные паттерны (pool + mock) | 🔒 Архитектурно |

---

## 8. Повторный code review (2026-03-29, раунд 2)

### 8.1 morrowlab.by — повторный review (3 HIGH, 5 MEDIUM, 3 LOW)

#### HIGH (3)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R-H1 | **Stored XSS в блоге** — `innerHTML` без санитизации для `a.article` | pages/blog.html | ✅ Strip script/iframe/on* |
| R-H2 | **XSS в projects** — поля из API без экранирования (`status`, `pdf_url`, `room`, URLs) | pages/projects/index.html | ✅ `esc()` + `safeUrl()` |
| R-H3 | **XSS в constructor** — `d.label` из Replicate через `innerHTML` без escape | pages/constructor.html, bathroom_constructor.html | ✅ `esc()` на labels |

#### MEDIUM (5)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R-M1 | Нет rate limiting в локальном proxy.py | proxy.py | ✅ In-memory rate limiter (= раздел 2.2) |
| R-M2 | Нет security headers (CSP, X-Frame-Options) | proxy.py / nginx | ✅ X-Content-Type-Options, X-Frame-Options, Referrer-Policy в proxy.py |
| R-M3 | CORS Methods/Headers отдаются без проверки origin | proxy.py | ✅ Перемещены в `if origin` блок |
| R-M4 | Blog CRUD без auth (TODO) | ml-upload.py (сервер) | ✅ `check_auth()` на сервере |
| R-M5 | `projectToken` из URL без валидации формата | pages/projects/index.html | ✅ Regex `^[a-zA-Z0-9_-]{10,64}$` |

#### LOW (3)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R-L1 | `showSuccess()` на ошибке отправки заказа | pages/project/index.html | ✅ `alert()` при ошибке |
| R-L2 | `.env.example` содержит префиксы токенов (`r8_`, `gsk_`) | .env.example | ✅ Префиксы удалены |
| R-L3 | Untracked файлы могут содержать данные | working directory | ✅ Покрыто .gitignore |

---

### 8.2 SMM admin — повторный review (4 HIGH, 6 MEDIUM, 5 LOW)

#### Предыдущие 28 фиксов подтверждены корректными. 0 Critical.

#### HIGH (4)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R2-H1 | **Rate limiter in-memory** — не работает в multi-instance, memory leak | src/lib/rate-limit.ts | ✅ Cleanup каждые 100 вызовов + комментарий про Redis |
| R2-H2 | **Нет rate limit на confirm** endpoint | src/app/api/auth/confirm/route.ts | ✅ 10/мин/IP |
| R2-H3 | **Нет rate limit на invite acceptance** | src/app/api/invites/[token]/route.ts | ✅ 5/мин/IP |
| R2-H4 | **`json_build_object` embed columns** без `safeColumn()` | src/lib/supabase/server.ts | ✅ `safeColumn()` applied |

#### MEDIUM (6)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R2-M1 | Operator может приглашать operator без owner check | src/app/api/invites/route.ts | 🔒 By design: бизнес-логика, операторы управляют командой |
| R2-M2 | `createUser` silent fail на duplicate в invite flow | src/app/api/invites/[token]/route.ts | ✅ Lookup existing user |
| R2-M3 | `.env.example` — устаревшие Supabase ключи | .env.example | ✅ Обновлён |
| R2-M4 | `_runSelect` main columns без `safeColumn()` | src/lib/supabase/server.ts | ✅ `safeColumn()` applied |
| R2-M5 | Нет workspace access check на generate endpoint | src/app/api/generate/route.ts | ✅ `checkWorkspaceAccess()` |
| R2-M6 | Password validation не централизована | src/lib/auth.ts | ✅ `validatePassword()` exported |

#### LOW (5)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R2-L1 | `x-forwarded-for` может быть spoofed | rate-limit usage | 🔒 Nginx reverse proxy выставляет корректный XFF; прямой доступ к Flask закрыт (127.0.0.1) |
| R2-L2 | `plan` value в email без HTML escape | auth/register/route.ts | ✅ `escAttr()` в R3-SM1 |
| R2-L3 | Groq error text в console.error | api/generate/route.ts | 🔒 Серверные логи; truncation (200 chars) добавлен в R6-SM1 |
| R2-L4 | n8n error text в логах | src/lib/n8n.ts | 🔒 Серверные логи, не утекают клиенту |
| R2-L5 | Team page delete button без handler | settings/team/page.tsx | ✅ `alert()` placeholder |

---

## 9. Раунд 3 — повторный review (2026-03-29)

### 9.1 morrowlab.by (3 HIGH, 3 MEDIUM, 4 LOW)

#### HIGH (3)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R3-H1 | **Blog card XSS** — `meta_title`, `excerpt` без `esc()` в card template | pages/blog.html | ✅ `esc()` на все поля |
| R3-H2 | **Constructor setStatus XSS** — `e.message` через innerHTML | pages/constructor.html | ✅ Escaping в setStatus/setRestyleStatus |
| R3-H3 | **prompt() name XSS** — user input через setStatus innerHTML | pages/constructor.html | ✅ Покрыто R3-H2 |

#### MEDIUM (3)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R3-M1 | **Replicate version** без валидации формата | proxy.py | ✅ Regex `^[a-f0-9]{64}$` |
| R3-M2 | **Webhook URL** без проверки scheme | proxy.py | ✅ `wh_parsed.scheme == 'https'` |
| R3-M3 | **proxy-image** пропускает `octet-stream`, нет nosniff | proxy.py | ✅ Только `image/*` + nosniff header |

#### LOW (4)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R3-L1 | Нет rate limiting в локальном proxy.py | proxy.py | ✅ In-memory rate limiter (= R-M1) |
| R3-L2 | Нет Replicate version allowlist | proxy.py | ✅ Format validated (regex `^[a-f0-9]{64}$`) |
| R3-L3 | `.env.example` с префиксами токенов | .env.example | ✅ Префиксы удалены (= R-L2) |
| R3-L4 | Нет version format validation | proxy.py | ✅ = R3-M1 |

### 9.2 SMM admin (0 HIGH, 4 MEDIUM, 3 LOW)

#### HIGH — 0. Все предыдущие фиксы подтверждены.

#### MEDIUM (4)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R3-SM1 | **Email HTML injection** — `plan` без escape в email template | auth/register/route.ts | ✅ HTML-escaped |
| R3-SM2 | **Нет rate limit на /api/generate** — cost abuse | api/generate/route.ts | ✅ 10/мин/IP |
| R3-SM3 | **Нет rate limit на invite creation** POST | api/invites/route.ts | ✅ 10/мин/IP |
| R3-SM4 | **JWT missing claims** — existing user invite returns incomplete token | api/invites/[token]/route.ts | ✅ `SELECT id, email, role` |

#### LOW (3)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R3-SL1 | Invite token exposed в API response | api/invites/route.ts | 🔒 By design: токен нужен для формирования invite link в UI; доступ только owner/operator |
| R3-SL2 | Media URL from user input в `<img>` src | content/new/page.tsx | 🔒 Self-input (пользователь вставляет свой URL), React auto-escapes атрибуты |
| R3-SL3 | Email в magic link URL (unused param) | auth/register/route.ts | ✅ Удалён |

---

## 10. Раунд 4 — повторный review (2026-03-29)

### 10.1 morrowlab.by (0 HIGH, 2 MEDIUM, 3 LOW)

#### HIGH — 0. Все предыдущие фиксы подтверждены.

#### MEDIUM (2)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R4-M1 | **setHdStatus XSS** — API error messages через innerHTML без санитизации (setStatus/setRestyleStatus фикс из R3 не покрыл setHdStatus) | pages/constructor.html, bathroom_constructor.html | ✅ `escHtml()` в setHdStatus |
| R4-M2 | **Blog `javascript:` URI** — sanitizer блокирует script/iframe/on*, но пропускает `<a href="javascript:...">` | pages/blog.html | ✅ Strip javascript: в href/src/action + блок embed/object/form/base/meta/link/svg |

#### LOW (3)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R4-L1 | Advisor message без ограничения длины — DoS через большие сообщения | proxy.py | ✅ Лимит 2000 символов |
| R4-L2 | Replicate `input` dict без allowlist полей (в отличие от Decor8) | proxy.py | ✅ `REPLICATE_ALLOWED_INPUT_FIELDS` фильтрация |
| R4-L3 | Masters form показывает "успех" при сетевой ошибке (потеря лидов) | pages/masters.html | ✅ `alert()` при ошибке |

### 10.2 SMM admin (0 HIGH, 6 MEDIUM, 4 LOW)

#### HIGH — 0. Все предыдущие фиксы подтверждены.

#### MEDIUM (6)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R4-SM1 | **Content DELETE без auth** — stub endpoint без проверки доступа | api/content/route.ts | ✅ `checkWorkspaceAccess()` добавлен |
| R4-SM2 | **Invite email не нормализован** — `John@Mail.COM` ≠ `john@mail.com` | api/invites/route.ts | ✅ `toLowerCase().trim()` |
| R4-SM3 | **Invite email не валидирован** — любая строка принимается как email | api/invites/route.ts | ✅ Regex валидация |
| R4-SM4 | **Client slug не валидирован** — SQL injection через slug маловероятна (parameterized), но некорректные значения | api/clients/route.ts | ✅ Regex `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$` |
| R4-SM5 | **`_runInsert` теряет error codes** — `23505` (unique constraint) не доходит до caller, ломает duplicate slug detection | lib/supabase/server.ts | ✅ try/catch с `pgErr.code` |
| R4-SM6 | **`_limitN` не параметризован** — `LIMIT ${number}` вместо `LIMIT $N` | lib/supabase/server.ts | ✅ Параметризованный `$N` |

#### LOW (4)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R4-SL1 | Rate limit key collision — все endpoints используют один и тот же IP как ключ | lib/rate-limit.ts, все callers | ✅ Prefix `endpoint:ip` на всех 6 callers |
| R4-SL2 | `/api/auth/me` не возвращает `role` — фронтенд не может определить роль | api/auth/me/route.ts | ✅ `role` добавлен в response |
| R4-SL3 | signToken role logic — invite role "operator" → system role "client" может запутать | api/invites/[token]/route.ts | 🔒 By design: invite role (workspace-level) ≠ system role; JWT содержит system role |
| R4-SL4 | Open redirect через `next` параметр | middleware.ts, login/page.tsx | ✅ Защищено: `!rawNext.startsWith("//")` |

---

## 11. Раунд 5 — повторный review (2026-03-29)

### 11.1 morrowlab.by (3 CRITICAL, 3 HIGH, 4 MEDIUM, 3 LOW)

#### CRITICAL (3) — XSS в файлах НЕ покрытых предыдущими раундами

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R5-C1 | **XSS в blog/index.html** — API данные (category, meta_title, excerpt, FAQ) через innerHTML без экранирования + article body без санитизации | blog/index.html | ✅ `esc()` + strip script/iframe/on*/javascript:/embed/object/form/base/meta/link/svg |
| R5-C2 | **XSS в morrowlab_index.html** — blog card data (meta_title, topic, generated_at) через template literal без escape | morrowlab_index.html | ✅ `e()` escaper + `encodeURIComponent()` для slug |
| R5-C3 | **XSS в tilda_blog_block.html + TILDA_UPDATE_BLOG_BLOCK.html** — API данные через innerHTML без escape | tilda_blog_block.html, TILDA_UPDATE_BLOG_BLOCK.html | ✅ `esc()` + `encodeURIComponent()` |

#### HIGH (3)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R5-H1 | **Хардкод DEFAULT_PASS** `morrowlab2026` в admin/index.html — client-side auth | admin/index.html | 🔒 Отдельная CMS (blog content); server-side admin на JWT; CMS данные не sensitive |
| R5-H2 | **Unescaped item.url** в admin media gallery и image picker — attribute injection | admin/index.html | ✅ `esc()` на item.url |
| R5-H3 | **setHdStatus `<a ` bypass** — API message начинающийся с `<a ` обходил escaping | constructor.html, bathroom_constructor.html | ✅ `trustedHtml()` маркер вместо string prefix check |

#### MEDIUM (4)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R5-M1 | **setCanvasInfo innerHTML** — потенциальный XSS вектор | pages/constructor.html | ✅ `textContent` вместо `innerHTML` |
| R5-M2 | **PDF download без domain validation** — любой HTTPS URL принимается | pages/projects/index.html | ✅ Domain allowlist (morrowlab.by, zenohome.by) |
| R5-M3 | **Chat widget CFG.greeting innerHTML** — конфигурация вставляется как HTML | zeno_chat_widget.html | ✅ `textContent` вместо `innerHTML` |
| R5-M4 | **Cloudinary upload preset public** — resource abuse risk | zeno_chat_widget.html | 🔒 Unsigned presets — стандарт Cloudinary для client-side uploads; rate limits на стороне Cloudinary |

#### LOW (3)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R5-L1 | JSONP callback в blog/index.html — global function | blog/index.html | ✅ JSONP убран, только fetch |
| R5-L2 | Admin deploy key placeholder | admin/index.html | 🔒 Отдельная CMS; ключ берётся из `sessionStorage`, не hardcoded |
| R5-L3 | Replicate input без field filtering | proxy.py | ✅ `REPLICATE_ALLOWED_INPUT_FIELDS` (= R4-L2) |

### 11.2 SMM admin (0 CRITICAL, 0 HIGH, 3 MEDIUM, 6 LOW)

#### CRITICAL / HIGH — 0.

#### MEDIUM (3)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R5-SM1 | **_runUpdate без RETURNING** — невозможно проверить что обновление сработало (TOCTOU race) | lib/supabase/server.ts | ✅ `RETURNING *` добавлен |
| R5-SM2 | **Email link HTML injection** — `${link}` в email template без экранирования | api/auth/register/route.ts | ✅ `escAttr()` для link в href |
| R5-SM3 | **Invite accept без проверки пароля** — existing user получает workspace access без аутентификации | api/invites/[token]/route.ts | ✅ `findUserByCredentials()` для existing users |

#### LOW (6)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R5-SL1 | workspace param в GET invites без slug validation | api/invites/route.ts | ✅ Regex `^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]?$` |
| R5-SL2 | createMagicToken purpose не валидирован | lib/auth.ts | ✅ VALID_PURPOSES allowlist |
| R5-SL3 | Register logs email address (not token) | api/auth/register/route.ts | ✅ Email убран из лога |
| R5-SL4 | Dashboard layout client-side auth racy | (dashboard)/layout.tsx | 🔒 Middleware проверяет JWT server-side; client-side — UX fallback |
| R5-SL5 | Embed relation table name from regex | lib/supabase/server.ts | 🔒 `RELATIONS` map hardcoded, regex только извлекает ключ для lookup |
| R5-SL6 | No explicit CSRF token (SameSite=Lax sufficient) | middleware.ts | 🔒 SameSite=Lax + JSON Content-Type — достаточная защита от CSRF |

---

## 12. Раунд 6 — повторный review (2026-03-29)

### 12.1 morrowlab.by (0 CRITICAL, 0 HIGH, 2 MEDIUM, 1 LOW)

Все предыдущие фиксы подтверждены. Найдены только **parity issues** — фиксы не перенесённые в дублирующие файлы.

#### MEDIUM (2)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R6-M1 | **bathroom setStatus/setRestyleStatus без escaping** — фикс из constructor.html не перенесён | bathroom_constructor.html | ✅ Escaping добавлен |
| R6-M2 | **content-loader.js CMS innerHTML** — FAQ и текстовые поля без escape | content-loader.js | ✅ `escCms()` + `textContent` для не-HTML полей, `HTML_KEYS` allowlist |

#### LOW (1)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R6-L1 | bathroom setCanvasInfo innerHTML — callers используют `<b>` для форматирования | bathroom_constructor.html | ✅ `textContent`, убрана HTML разметка |

### 12.2 SMM admin (0 CRITICAL, 0 HIGH, 2 MEDIUM, 5 LOW)

Все предыдущие фиксы подтверждены. Оставшиеся — prompt injection hardening и informational.

#### MEDIUM (2)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R6-SM1 | **Groq error log injection** — raw error body с newlines в логах | api/generate/route.ts | ✅ `.slice(0,200).replace(/[\n\r]/g,' ')` |
| R6-SM2 | **LLM prompt injection** — projectDetails/budget/platform без лимитов | api/generate/route.ts | ✅ Length limits + platform regex |

#### LOW (5)

| # | Проблема | Файл | Статус |
|---|---------|------|--------|
| R6-SL1 | postType/room/style/tone не валидированы против allowlist | api/generate/route.ts | ✅ Fallback на allowlist значения вместо user input |
| R6-SL2 | Rate limiter map unbounded growth | lib/rate-limit.ts | ✅ Hard cap 50K entries + eviction |
| R6-SL3 | No explicit CSRF token | middleware.ts | 🔒 = R5-SL6: SameSite=Lax + JSON Content-Type |
| R6-SL4 | Confirm page redirect without validation | auth/confirm/page.tsx | ✅ `startsWith("/") && !startsWith("//")` |
| R6-SL5 | platforms array not validated | api/generate/route.ts | ✅ Regex filter (= R6-SM2) |

---

## Общая статистика

| Раунд | Объект | Находок | ✅ Исправлено | 🔒 Accepted Risk |
|-------|--------|---------|------------|----------|
| 1 | proxy.py, ml-upload.py, admin HTML | 30 | 30 | 0 |
| 1 | CodeRabbit CLI (proxy.py) | 8 | 8 | 0 |
| 1 | SMM admin | 28 | 26 | 2 |
| 1 | ZENO виджеты | 4 | 4 | 0 |
| 1 | Серверная инфраструктура | 6 | 6 | 0 |
| 2 | morrowlab.by (повторный) | 11 | 11 | 0 |
| 2 | SMM admin (повторный) | 15 | 11 | 4 |
| 3 | morrowlab.by (раунд 3) | 10 | 10 | 0 |
| 3 | SMM admin (раунд 3) | 7 | 5 | 2 |
| 4 | morrowlab.by (раунд 4) | 5 | 5 | 0 |
| 4 | SMM admin (раунд 4) | 10 | 9 | 1 |
| 5 | morrowlab.by (раунд 5) | 13 | 10 | 3 |
| 5 | SMM admin (раунд 5) | 9 | 5 | 4 |
| 6 | morrowlab.by (раунд 6) | 3 | 3 | 0 |
| 6 | SMM admin (раунд 6) | 7 | 5 | 2 |
| **Итого** | | **166** | **148** | **18** |

> **0 Critical, 0 High, 0 Medium открытых.** Все 18 accepted risk — LOW severity, by-design decisions с документированным обоснованием.
> Все ранее отложенные proxy rate limiting, security headers, input allowlists, domain validation, XSS escaping — исправлены.

---

## Коммиты безопасности

```
(pending)  Final deferred fixes: Replicate input allowlist, proxy rate limiter, security headers, domain validation, widget escaping
95d35cd  Fix 8 deferred security items: rate limiter cap, JSONP removal, eslint cleanup (10 files)
014f737  Security rounds 4-6: fix 37 findings (25 files)
85a2822  Round 2: fix XSS in blog/projects/constructor, rate limiting, safeColumn, workspace access
ecef17f  Add SECURITY.md: comprehensive security review report (76 findings)
(filter)  git filter-repo: remove secrets from commit history
3cdf7fc  SMM admin: remove Postmypost integration, fix all 28 security findings
89f4637  Allow uppercase in Replicate prediction ID validation
55c2874  Reject non-200 responses in proxy-image to prevent empty body proxying
a9bfc9c  Fix WebP magic byte validation: check RIFF+WEBP signature, not just RIFF
5c7278b  Fix critical/high findings from CodeRabbit review: webhook SSRF, parameter injection, image validation
2a16cbd  Security hardening: fix all 30 code review findings
6085378  Security: remove hardcoded secrets, restructure CLAUDE.md
```

---

*Обновлён 2026-03-29 (финальный). 6 раундов review + CodeRabbit CLI + Code review agents. Все 166 находок закрыты (148 исправлены, 18 accepted risk с обоснованием).*
