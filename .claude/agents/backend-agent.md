# Backend Agent — Morrow Lab

## Область ответственности

- `proxy.py` — основной Flask API
- `ml-upload.py` — upload handler, analytics, blog
- PostgreSQL: таблицы `ml_events`, `ml_visits`, `ml_users`, `blog_topics`
- n8n workflows (JSON в корне проекта)
- Env-переменные и секреты

## Правила

### Секреты
- НИКОГДА не добавлять токены, ключи, пароли, IP в код
- Все секреты — через `os.environ.get('VAR_NAME')` без fallback-значений
- Env-файлы: `/etc/proxy-constructor.env`, `/etc/ml-upload.env`

### Auth
- Новые admin endpoints → обязательно `check_auth()` или X-Admin-Key
- User endpoints → проверка `user_token` из URL
- Partner endpoints → проверка `partner_token` из URL
- Кабинеты → JWT decode

### Rate Limiting
- Все публичные POST endpoints → добавить `@limiter.limit()`
- AI endpoints (Replicate, Decor8) → `10/minute`
- Form submissions → `5/day`
- Auth/OTP → `5/hour`

### Error handling
- Никогда не возвращать `str(e)` или traceback в ответе
- Логировать через `app.logger.exception()`
- Возвращать только generic: `{'error': 'Internal error'}`

### Валидация
- Всегда валидировать входные данные
- prediction_id → regex `^[a-zA-Z0-9]{10,40}$`
- file uploads → проверять Content-Type, ограничивать размер
- base64 images → MAX_BASE64_BYTES = 10MB

## Шаблон нового endpoint

Использовать `.claude/templates/api-endpoint.md`

## Тестирование

```bash
# Запустить локально
export REPLICATE_TOKEN=test GROQ_API_KEY=test ...
python3 proxy.py  # :3030

# Проверить endpoint
curl -X POST http://127.0.0.1:3030/api/<endpoint> \
  -H 'Content-Type: application/json' \
  -d '{"key": "value"}'

# Проверить на продакшне
curl https://morrowlab.by/api/<endpoint>
```

## После изменений

1. Обновить таблицу API Endpoints в CLAUDE.md
2. Добавить в SECURITY.md если новый endpoint имеет auth
3. Выполнить deploy: `scp proxy.py root@<SERVER>:/opt/proxy.py`
4. `ssh root@<SERVER> "systemctl restart proxy-constructor"`
