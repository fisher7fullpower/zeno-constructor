# Шаблон: Новый API endpoint (proxy.py)

> Добавлять в `proxy.py`. Соблюдать порядок: rate limit → validation → auth → logic → error handling.

## Flask endpoint

```python
@app.route('/api/{{ENDPOINT}}', methods=['POST'])
@limiter.limit("{{RATE}}/minute")  # например: "10/minute" или "5/hour"
def {{FUNCTION_NAME}}():
    """{{DESCRIPTION}}"""
    # 1. Validate Content-Type
    if not request.is_json:
        return jsonify({'error': 'JSON required'}), 400

    data = request.get_json(silent=True) or {}

    # 2. Validate required fields
    field = data.get('field', '').strip()
    if not field:
        return jsonify({'error': 'field required'}), 400

    # 3. Auth (если нужна)
    # user_token = request.args.get('token', '')
    # req = load_request(rid)  # для user_token
    # if req.get('user_token') != user_token:
    #     return jsonify({'error': 'forbidden'}), 403

    # 4. Business logic
    try:
        result = do_something(field)
        return jsonify({'ok': True, 'result': result})
    except Exception:
        app.logger.exception('{{FUNCTION_NAME}} error')
        return jsonify({'error': 'Internal error'}), 500
```

## Auth варианты

### Ничего (публичный endpoint)
```python
# Нет auth — только rate limit
```

### user_token в URL
```python
rid = request.args.get('rid', '')
user_token = request.args.get('token', '')
req = load_request(rid)
if not req or req.get('user_token') != user_token:
    return jsonify({'error': 'forbidden'}), 403
```

### JWT cookie (кабинет)
```python
token = request.cookies.get('token')
if not token:
    return jsonify({'error': 'unauthorized'}), 401
try:
    payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    email = payload['email']
except jwt.PyJWTError:
    return jsonify({'error': 'invalid token'}), 401
```

### X-Admin-Key header
```python
if request.headers.get('X-Admin-Key') != ADMIN_KEY:
    return jsonify({'error': 'forbidden'}), 403
```

## Rate limit примеры

```python
@limiter.limit("5/day")      # Форма заявки
@limiter.limit("10/minute")  # AI запросы
@limiter.limit("20/minute")  # Чтение данных
@limiter.limit("5/hour")     # Auth/OTP
```

## Добавить в CLAUDE.md

После создания endpoint — добавить строку в таблицу API Endpoints в CLAUDE.md.
