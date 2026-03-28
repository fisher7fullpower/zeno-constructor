# Morrow Lab — CLAUDE.md

> AI-платформа дизайна интерьеров. Беларусь, Минск. morrowlab.by

---

## Guardrails

1. **НИКОГДА не коммить секреты.** Все ключи хранятся в env-переменных и `/etc/ml-upload.env`. Не добавлять токены, пароли, IP-адреса в код или документацию.
2. **Навигация одинаковая на ВСЕХ страницах.** При изменении header/footer — менять на каждой странице (20+ файлов).
3. **Все страницы — single-file HTML** (CSS + JS inline). Нет сборщиков, нет npm.
4. **Тёмная тема** с lime `#d1fe17` акцентом. Шрифт Inter. Не менять цветовую схему.
5. **JSON storage** для заявок/партнёров (без ORM, без миграций). PostgreSQL только для аналитики, токенов и блога.
6. **Email через Resend** — не SMTP.
7. **AI:** Groq (LLM) + HomeDesigns.ai (рендеры) + Replicate (upscale, FLUX).
8. **Не добавлять npm-зависимости.** Всё работает на чистом HTML/JS/CSS.

---

## Сборка и деплой

Сборки нет. Файлы деплоятся напрямую на сервер.

```bash
# Перезапуск сервисов (на сервере)
systemctl restart proxy-constructor   # Flask API :3030
systemctl restart ml-upload           # Upload handler :3001
systemctl restart nginx

# Логи
journalctl -u proxy-constructor -f
journalctl -u ml-upload -f
```

---

## Архитектура

```
Пользователь → nginx (443 SSL) → proxy.py :3030 (Flask API)
                                       ├── Replicate API (AI renders)
                                       ├── HomeDesigns.ai (interior design)
                                       ├── Groq API (LLM chat)
                                       ├── Resend (email)
                                       └── JSON files (data/)
                                 → ml-upload.py :3001 (Webhook handler)
                                       ├── PostgreSQL (analytics, tokens, blog)
                                       └── wkhtmltopdf (PDF)
                                 → n8n :5678 (Docker, workflow automation)
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

| Файл | Порт | Фреймворк | Назначение |
|------|------|-----------|-----------|
| `/opt/proxy.py` | 3030 | Flask | Основной API (~1170 строк) |
| `/opt/ml-upload.py` | 3001 | http.server | Uploads, analytics, blog |

### Конфигурация

| Файл | Назначение |
|------|-----------|
| `/etc/nginx/sites-enabled/morrowlab` | Nginx конфиг |
| `/etc/ml-upload.env` | Env-переменные ml-upload (admin key) |

### Фронтенд (`/var/www/morrowlab.by/html/`)

| Путь | Назначение |
|------|-----------|
| `index.html` | Главная лендинг |
| `room/`, `kitchen/`, `sanuzel/`, `business/`, `dom/` | AI-рендеринг помещений |
| `estimate/` | Сравнить цены (форма заявки) |
| `project/` | Дизайн Студия |
| `moodboard/` | AI Мудборд |
| `r/` | Статус заявки (доступ по токену в URL) |
| `my/` | Кабинет пользователя (OTP) |
| `partner/reply/` | Ответ партнёра на заявку |
| `partner/dashboard/` | Кабинет партнёра (OTP) |
| `admin/` | Админ CMS |
| `blog/`, `masters/`, `b2b/`, `about/`, `privacy/`, `oferta/` | Инфо-страницы |

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

## API Endpoints (proxy.py :3030)

### AI / Рендеринг

| Метод | Route | Назначение |
|-------|-------|-----------|
| POST | `/api/replicate` | Replicate prediction (base64→URL) |
| GET | `/api/replicate/<id>` | Статус prediction |
| POST | `/api/homedesigns/v2/<endpoint>` | Прокси к HomeDesigns.ai |
| POST | `/api/homedesigns/advisor` | AI-дизайн консультант |
| POST | `/api/upscale` | Real-ESRGAN upscale |
| GET | `/api/proxy-image` | CORS proxy для внешних изображений |
| POST | `/api/moodboard` | Анализ стиля через Groq |
| POST | `/api/consultant` | AI консультант по ремонту |

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

| Метод | Route | Назначение |
|-------|-------|-----------|
| POST | `/api/auth/send-code` | Отправить OTP на email |
| POST | `/api/auth/verify-code` | Проверить код → JWT cookie (30 дней) |
| POST | `/api/auth/logout` | Удалить cookie |
| GET | `/api/auth/me` | Проверить авторизацию |
| GET | `/api/my/requests` | Заявки пользователя (JWT) |
| GET | `/api/partner/requests` | Заявки партнёра (JWT) |

### Админка

| Метод | Route | Назначение |
|-------|-------|-----------|
| GET | `/api/admin/utm-analytics` | UTM-аналитика |
| GET | `/api/admin/requests` | Все заявки |
| GET/POST | `/api/admin/partners` | Управление партнёрами |

## API Endpoints (ml-upload.py :3001)

| Route | Auth | Назначение |
|-------|------|-----------|
| `POST /webhook/photo-upload` | — | Публичная загрузка фото (max 10MB) |
| `POST /webhook/admin-upload` | Admin Key | Админ-загрузка (max 15MB) |
| `POST /webhook/save-render` | — | Скачивание рендера с URL |
| `POST /webhook/save-report` | Admin Key | HTML отчёт |
| `POST /webhook/track-event` | — | Аналитическое событие → PostgreSQL |
| `POST /webhook/morrow-support` | — | AI-чат поддержки |
| `POST /webhook/morrow-check-tokens` | — | Токены пользователя |
| `GET/POST /webhook/admin-content-*` | — | Блог CRUD |

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
/api/*                    → proxy :3030 (proxy.py)
/webhook/photo-upload     → proxy :3001 (ml-upload.py)
/webhook/admin-upload     → proxy :3001
/webhook/save-render      → proxy :3001
/webhook/save-report      → proxy :3001
/webhook/track-event      → proxy :3001
/webhook/morrow-*         → proxy :3001
/webhook/admin-*          → proxy :3001
/webhook/*                → proxy :5678 (n8n, catch-all)
/uploads/requests/        → static (вложения заявок)
/images/renders/          → static, no-cache
```

---

## База данных PostgreSQL (`morrowlab_studio`)

| Таблица | Назначение |
|---------|-----------|
| `ml_events` | Аналитические события |
| `ml_visits` | Визиты |
| `ml_users` | Пользователи + токены рендеринга |
| `blog_topics` | Статьи блога |
