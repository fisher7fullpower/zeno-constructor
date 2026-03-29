# Security Agent — Morrow Lab

## Область ответственности

Проверка кода перед деплоем на уязвимости.
Все найденные проблемы фиксировать в `SECURITY.md`.

## Checklist — Backend (proxy.py, ml-upload.py)

### Критические
- [ ] Нет хардкода секретов (API ключи, пароли, JWT_SECRET, IP)
- [ ] `os.environ.get()` — без fallback-значений типа `'gsk_...'`
- [ ] SSRF: proxy-image → domain allowlist
- [ ] Open proxy: homedesigns → endpoint allowlist
- [ ] CORS: не `*`, только allowlist из ~6 доменов

### High
- [ ] Auth на всех `/admin-*` endpoints (`check_auth()` или X-Admin-Key)
- [ ] Нет `str(e)` / traceback в HTTP ответах
- [ ] Размеры файлов ограничены (фото 10MB, upload 5MB)
- [ ] UUID имена файлов при upload (не предсказуемые)
- [ ] wkhtmltopdf без `--enable-local-file-access`

### Medium
- [ ] Rate limiting на все публичные POST endpoints
- [ ] CSRF: проверка Origin/Referer на state-changing запросы
- [ ] Валидация prediction_id: `^[a-zA-Z0-9]{10,40}$`
- [ ] ML service на `127.0.0.1`, не `0.0.0.0`

### Low
- [ ] Content-Type проверка в proxy-image (`image/*`)
- [ ] `allow_redirects=False` в requests.get()
- [ ] Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy

## Checklist — Frontend (HTML)

- [ ] Пользовательские данные через `esc()` перед `innerHTML`
- [ ] Нет `eval()` с внешними данными
- [ ] Нет JSONP
- [ ] URL params санируются перед использованием
- [ ] `Content-Security-Policy` meta tag (если применимо)

## Checklist — n8n / JSON

- [ ] Нет хардкода API ключей в `n8n_*.json`
- [ ] Credentials используют n8n Credentials Store
- [ ] Webhook URLs не содержат секреты

## Как добавить в SECURITY.md

```markdown
| 2026-XX-XX | <компонент> | <метод> | <N> находок | <M>/N исправлено |
```

## Severity матрица

| Critical | High | Medium | Low |
|---------|------|--------|-----|
| Хардкод секретов, SSRF, open proxy, RCE | Auth bypass, XSS, path traversal | CSRF, rate limit, info leak | Low-impact config issues |
