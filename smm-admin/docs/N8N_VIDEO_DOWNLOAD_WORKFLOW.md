# n8n: отдельный workflow «видео → скачать» (без обязательного постинга)

## Назначение

- **Отдельная цепочка** от `smm-generate`: только **картинка по URL + сценарий → видео URL + опциональные подсказки текста**.
- Пользователь **сам скачивает** ролик и публикует в Instagram / TikTok / другое; **вход в SMM-админку не обязателен** для этого сценария.
- Ответ явно помечает `publish_required: false` и текстом напоминает про **временность** ссылок Replicate.

Файл для импорта в n8n: **`n8n_video_download_workflow.json`** (в корне `smm-admin/`).

## Webhook

| Параметр | Значение |
|----------|----------|
| Метод | `POST` |
| Path | `smm-video-download` (полный URL: `{N8N_BASE}/webhook/smm-video-download` или как настроен production) |
| Заголовок | `X-SMM-Secret: <тот же секрет, что и для smm-generate>` |

Переменная окружения n8n: **`SMM_WEBHOOK_SECRET`** (как в узле `Validate & Parse`).

## Тело запроса (JSON)

```json
{
  "source_image_url": "https://example.com/frame.jpg",
  "scenario": "Медленный наезд на диван, утренний свет, уют",
  "niche": "Дизайн интерьеров",
  "platforms": ["instagram", "tiktok"],
  "aspect_preset": "9:16",
  "replicate_version": "опционально — hash версии модели Replicate"
}
```

- **`source_image_url`** — обязателен: публичный HTTPS URL, который **может скачать** ваш бэкенд / Replicate (без cookie-auth).
- Остальные поля опциональны; сценарий может быть пустым — LLM подставит нейтральное движение.

## Успешный ответ (200)

```json
{
  "video_url": "https://...",
  "motion_prompt_en": "...",
  "caption_suggestion": "...",
  "hashtags_suggestion": ["#...", "#..."],
  "source_image_url": "https://...",
  "flow": "download_only",
  "publish_required": false,
  "notice": "..."
}
```

Клиент (лендинг, админка, скрипт) может показать кнопку **«Скачать»** (`video_url`) и блок «идеи для подписи» — без вызова `/api/content`.

## Ошибка (400)

Если нет `source_image_url`:

```json
{
  "error": "source_image_url required",
  "hint": "Загрузите изображение и передайте публичный HTTPS URL, доступный для Replicate."
}
```

## Технические детали

1. **Replicate** вызывается через тот же прокси, что и в `n8n_smm_generate_workflow.json`: `https://constructor.morrowlab.by/api/replicate` (при необходимости замените на свой endpoint или прямой API Replicate).
2. По умолчанию в теле prediction используется **Stable Video Diffusion (img2vid)** — тот же `replicate_version`, что в старом workflow. Поле **`motion_prompt_en` сейчас не подмешивается в input SVD** (у этой модели другой интерфейс); оно нужно для **отображения**, поста и для **будущей замены** ноды на Kling / Veo с text+I2V.
3. Чтобы сменить модель: в n8n поменяйте узел **Replicate — Start I2V** (и при необходимости `replicate_version` в теле запроса) под выбранную модель на Replicate.

## Временное хранение «у себя на сервере»

Этот workflow **не кладёт** файл на диск: он возвращает URL выхода Replicate.

Чтобы хранить у себя временно:

1. После ответа n8n **или** отдельным шагом в n8n: `HTTP Request` GET по `video_url` → `POST` в Supabase Storage / S3 → отдать клиенту **свой** URL с политикой TTL и CRON-очисткой.
2. В документе [ARCHITECTURE_VIDEO_POST_PIPELINE.md](./ARCHITECTURE_VIDEO_POST_PIPELINE.md) это можно развить как фазу v2.

## Импорт в n8n

1. Workflows → Import from File → `n8n_video_download_workflow.json`.
2. Подключить credential **GPTunnel API** (как в workflow `SMM Generate Post`) к узлу **GPT — Motion + Caption**.
3. Убедиться, что **Webhook** активирован и path не конфликтует.
4. Задать **`SMM_WEBHOOK_SECRET`** в Environment Variables инстанса n8n.
