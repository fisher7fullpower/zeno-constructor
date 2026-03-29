# Чеклист деплоя — Morrow Lab

## Перед деплоем

- [ ] Нет хардкода секретов (токенов, паролей, IP) в коде
- [ ] Изменён header/footer → проверены ВСЕ 23 страницы
- [ ] Нет `console.log` с чувствительными данными
- [ ] API endpoint добавлен в CLAUDE.md (если новый)
- [ ] `git commit` и `git push` выполнены

## Деплой файлов

```bash
# Одиночный файл
scp <file> root@<SERVER>:/var/www/morrowlab.by/html/<path>

# Бэкенд (proxy.py)
scp proxy.py root@<SERVER>:/opt/proxy.py
ssh root@<SERVER> "systemctl restart proxy-constructor"

# ml-upload.py
scp ml-upload.py root@<SERVER>:/opt/ml-upload.py
ssh root@<SERVER> "systemctl restart ml-upload"
```

## После деплоя

- [ ] `systemctl is-active proxy-constructor ml-upload nginx` → все `active`
- [ ] Проверить главную страницу в браузере
- [ ] Проверить изменённую функцию через curl или браузер
- [ ] Если изменился API — проверить endpoint:

```bash
# Health check
curl https://morrowlab.by/api/partners

# ml-upload
curl https://morrowlab.by/webhook/morrow-check-tokens?email=test@test.com
```

## Rollback

```bash
# Вернуть предыдущую версию файла
scp backups/<file>.bak root@<SERVER>:/var/www/morrowlab.by/html/<path>
ssh root@<SERVER> "systemctl restart <service>"
```

## Частые ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| 502 Bad Gateway | proxy.py упал | `systemctl restart proxy-constructor` |
| 404 на новой странице | Нет файла на сервере | `scp` файл |
| Стили не обновились | Кэш браузера | Ctrl+Shift+R |
| OTP не приходит | Resend API | Проверить RESEND_KEY в env |
| Рендер зависает | Replicate timeout | Проверить REPLICATE_TOKEN |
