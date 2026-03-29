from flask import Flask, request, jsonify, Response as FlaskResponse
import requests, base64, uuid, os, re, time, json, hashlib, secrets
from urllib.parse import urlparse
from datetime import datetime, timedelta
import jwt

app = Flask(__name__)

# ── Security: in-memory rate limiter ──
_rate_store = {}
_rate_cleanup_counter = 0

def rate_limit(key, limit=30, window=60):
    """Simple in-memory rate limiter. Returns True if allowed."""
    global _rate_cleanup_counter
    _rate_cleanup_counter += 1
    now = time.time()
    if _rate_cleanup_counter % 200 == 0:
        expired = [k for k, v in _rate_store.items() if now > v['reset']]
        for k in expired: del _rate_store[k]
        if len(_rate_store) > 50000:
            _rate_store.clear()
    entry = _rate_store.get(key)
    if not entry or now > entry['reset']:
        _rate_store[key] = {'count': 1, 'reset': now + window}
        return True
    entry['count'] += 1
    return entry['count'] <= limit

REPLICATE_TOKEN   = os.environ.get('REPLICATE_TOKEN', '')
HOMEDESIGNS_TOKEN = os.environ.get('HOMEDESIGNS_TOKEN', '')
RESEND_KEY        = os.environ.get('RESEND_KEY', '')
FROM_EMAIL        = os.environ.get('FROM_EMAIL', 'noreply@morrowlab.by')
JWT_SECRET        = os.environ.get('JWT_SECRET', '')
ADMIN_KEY         = os.environ.get('ADMIN_KEY', '')
GROQ_API_KEY      = os.environ.get('GROQ_API_KEY', '')

if not REPLICATE_TOKEN or not HOMEDESIGNS_TOKEN:
    import sys
    print("FATAL: REPLICATE_TOKEN and/or HOMEDESIGNS_TOKEN not set in environment", file=sys.stderr)
    sys.exit(1)

REPLICATE_HDRS = {'Authorization': 'Token ' + REPLICATE_TOKEN, 'Content-Type': 'application/json'}

UPLOAD_DIR = '/var/www/constructor.zenohome.by/uploads'
UPLOAD_URL = 'https://constructor.zenohome.by/uploads'
os.makedirs(UPLOAD_DIR, exist_ok=True)

DATA_DIR      = '/var/www/morrowlab.by/html/data'
REQUESTS_DIR  = DATA_DIR + '/requests'
PARTNERS_FILE = DATA_DIR + '/partners.json'
os.makedirs(REQUESTS_DIR, exist_ok=True)

# ── Security: CORS allowlist ──
ALLOWED_ORIGINS = {
    'https://morrowlab.by',
    'https://www.morrowlab.by',
    'https://constructor.morrowlab.by',
    'https://zenohome.by',
    'https://www.zenohome.by',
    'https://constructor.zenohome.by',
}

def cors_and_security(r):
    origin = request.headers.get('Origin', '')
    if origin in ALLOWED_ORIGINS:
        r.headers['Access-Control-Allow-Origin'] = origin
        r.headers['Access-Control-Allow-Credentials'] = 'true'
        r.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        r.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    # Security headers
    r.headers['X-Content-Type-Options'] = 'nosniff'
    r.headers['X-Frame-Options'] = 'DENY'
    r.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    return r

app.after_request(cors_and_security)

# ── Security: image proxy domain allowlist ──
PROXY_IMAGE_ALLOWED_DOMAINS = {
    'homedesigns.ai',
    'www.homedesigns.ai',
    'api.homedesigns.ai',
    'replicate.delivery',
    'pbxt.replicate.delivery',
    'tjzk.replicate.delivery',
}

# ── Security: HomeDesigns endpoint allowlist ──
HOMEDESIGNS_ALLOWED_ENDPOINTS = {
    'redesign_room',
    'redesign_room_pro',
    'generate_room',
    'generate_room_pro',
    'design_advisor',
    'upscale',
    'fill_room',
    'empty_room',
    'style_transfer',
    'sketch_to_render',
    'floor_plan_to_render',
    'creative_redesign',
}

# ── Security: HomeDesigns allowed form fields ──
HOMEDESIGNS_ALLOWED_FIELDS = {
    'image', 'image_url', 'mask', 'mask_url', 'prompt', 'negative_prompt',
    'room_type', 'design_style', 'design_theme', 'num_images', 'resolution',
    'mode', 'scale', 'seed', 'strength', 'guidance_scale',
    'custom_message', 'color_scheme', 'material', 'furniture_style',
    'design_type', 'ai_intervention', 'no_design', 'house_angle',
}

# ── Security: Replicate input allowed fields ──
REPLICATE_ALLOWED_INPUT_FIELDS = {
    'image', 'prompt', 'negative_prompt', 'width', 'height', 'num_outputs',
    'scheduler', 'num_inference_steps', 'guidance_scale', 'seed', 'scale',
    'face_enhance', 'tile', 'version', 'model', 'output_format', 'output_quality',
    'aspect_ratio', 'safety_tolerance', 'prompt_upsampling', 'go_fast',
    'megapixels', 'disable_safety_checker',
}

# ── Security: max base64 image size (10 MB decoded) ──
MAX_BASE64_BYTES = 10 * 1024 * 1024

def save_base64_image(data_url):
    """Save base64 data URI to uploads dir, return public URL."""
    m = re.match(r'data:(image/[\w+]+);base64,(.+)', data_url, re.DOTALL)
    if not m:
        return None
    ext = m.group(1).split('/')[-1].replace('jpeg', 'jpg')
    # Security: only allow safe image extensions (no SVG — can contain JS)
    if ext not in ('png', 'jpg', 'gif', 'webp'):
        return None
    img_bytes = base64.b64decode(m.group(2))
    if len(img_bytes) > MAX_BASE64_BYTES:
        return None
    # Security: validate magic bytes match declared type
    MAGIC = {
        'png': b'\x89PNG', 'jpg': b'\xff\xd8\xff',
        'gif': b'GIF8',
    }
    if ext in MAGIC and not img_bytes.startswith(MAGIC[ext]):
        return None
    # WebP: check RIFF header AND WEBP signature at offset 8
    if ext == 'webp' and (not img_bytes.startswith(b'RIFF') or img_bytes[8:12] != b'WEBP'):
        return None
    filename = str(uuid.uuid4()) + '.' + ext
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, 'wb') as f:
        f.write(img_bytes)
    return UPLOAD_URL + '/' + filename

# ── Email (Resend API) ───────────────────────────────────────────────
def send_email(to_email, subject, html_body):
    """Send email via Resend API. Returns True on success."""
    if not RESEND_KEY:
        return False
    try:
        resp = requests.post(
            'https://api.resend.com/emails',
            headers={'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json'},
            json={'from': FROM_EMAIL if '<' in FROM_EMAIL else 'Morrow Lab <' + FROM_EMAIL + '>', 'to': [to_email],
                  'subject': subject, 'html': html_body},
            timeout=15
        )
        return resp.status_code in (200, 201)
    except Exception:
        return False

# ── Request/Lead data helpers ────────────────────────────────────────
_req_rate_limits = {}  # ip -> [timestamps]

def check_request_rate_limit(ip, max_per_day=5, cooldown_sec=120):
    now = time.time()
    if ip not in _req_rate_limits:
        _req_rate_limits[ip] = []
    _req_rate_limits[ip] = [t for t in _req_rate_limits[ip] if now - t < 86400]
    if len(_req_rate_limits[ip]) >= max_per_day:
        return False, 'Лимит заявок на сегодня исчерпан'
    if _req_rate_limits[ip] and now - _req_rate_limits[ip][-1] < cooldown_sec:
        return False, 'Подождите 2 минуты перед следующей заявкой'
    return True, ''

def load_partners():
    try:
        with open(PARTNERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f).get('partners', [])
    except Exception:
        return []

def save_request(req_data):
    rid = req_data['id']
    with open(os.path.join(REQUESTS_DIR, rid + '.json'), 'w', encoding='utf-8') as f:
        json.dump(req_data, f, ensure_ascii=False, indent=2)

def load_request(rid):
    if not re.match(r'^[A-Za-z0-9_\-]{1,32}$', rid):
        return None
    path = os.path.join(REQUESTS_DIR, rid + '.json')
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

# ── OTP Auth helpers ─────────────────────────────────────────────────
OTP_STORE = {}  # {email: {code, expires, attempts, created, role}}

def generate_otp():
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])

def create_jwt_token(email, role, partner_id=None):
    if not JWT_SECRET:
        raise RuntimeError('JWT_SECRET not configured')
    payload = {'email': email, 'role': role, 'exp': datetime.utcnow() + timedelta(days=30)}
    if partner_id:
        payload['partner_id'] = partner_id
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_jwt_token(token_str):
    if not JWT_SECRET:
        return None
    try:
        return jwt.decode(token_str, JWT_SECRET, algorithms=['HS256'])
    except Exception:
        return None

def get_auth_from_cookie():
    token_str = request.cookies.get('ml_session', '')
    if not token_str:
        return None
    return verify_jwt_token(token_str)

def check_admin_auth():
    """Returns True if request has valid admin key."""
    if not ADMIN_KEY:
        return False
    return request.headers.get('X-Admin-Key', '') == ADMIN_KEY

# ── Replicate ────────────────────────────────────────────────────────
@app.route('/api/replicate', methods=['POST', 'OPTIONS'])
def replicate_create():
    if request.method == 'OPTIONS': return '', 204
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip()
    if not rate_limit('replicate:' + ip, 30, 60):
        return jsonify({'error': 'Too many requests'}), 429
    data = request.get_json(force=True) or {}
    # Validate: must have 'version' field
    if 'version' not in data:
        return jsonify({'error': 'version field is required'}), 400
    raw_inp = data.get('input', {})
    # Security: only forward allowed input fields
    inp = {k: v for k, v in raw_inp.items() if k in REPLICATE_ALLOWED_INPUT_FIELDS}
    # Convert base64 image → hosted URL
    if isinstance(inp.get('image'), str) and inp['image'].startswith('data:'):
        url = save_base64_image(inp['image'])
        if url:
            inp['image'] = url
    # Only forward safe fields
    version = data.get('version', '')
    if not isinstance(version, str) or not re.match(r'^[a-f0-9]{64}$', version):
        return jsonify({'error': 'Invalid version'}), 400
    safe_data = {
        'version': version,
        'input': inp,
    }
    if 'webhook' in data:
        wh_parsed = urlparse(data['webhook'])
        if wh_parsed.scheme == 'https' and wh_parsed.hostname and any(
            wh_parsed.hostname == d or wh_parsed.hostname.endswith('.' + d)
            for d in ('morrowlab.by', 'zenohome.by')
        ):
            safe_data['webhook'] = data['webhook']
    try:
        resp = requests.post(
            'https://api.replicate.com/v1/predictions',
            json=safe_data, headers=REPLICATE_HDRS, timeout=30
        )
        return jsonify(resp.json()), resp.status_code
    except Exception:
        return jsonify({'error': 'Service unavailable'}), 502

@app.route('/api/replicate/<pred_id>', methods=['GET'])
def replicate_status(pred_id):
    if not re.match(r'^[a-zA-Z0-9]{10,40}$', pred_id):
        return jsonify({'error': 'Invalid prediction ID'}), 400
    try:
        resp = requests.get(
            'https://api.replicate.com/v1/predictions/' + pred_id,
            headers=REPLICATE_HDRS, timeout=30
        )
        return jsonify(resp.json()), resp.status_code
    except Exception:
        return jsonify({'error': 'Service unavailable'}), 502

# ── homedesigns.ai generic v2 proxy ──────────────────────────────────
@app.route('/api/homedesigns/v2/<path:endpoint>', methods=['POST', 'OPTIONS'])
def homedesigns_v2(endpoint):
    if request.method == 'OPTIONS': return '', 204
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip()
    if not rate_limit('hd:' + ip, 20, 60):
        return jsonify({'error': 'Too many requests'}), 429
    if endpoint not in HOMEDESIGNS_ALLOWED_ENDPOINTS:
        return jsonify({'error': 'Unknown endpoint'}), 400
    data = request.get_json(force=True) or {}
    form_fields = {}
    for key, value in data.items():
        if key not in HOMEDESIGNS_ALLOWED_FIELDS:
            continue
        if isinstance(value, bool):
            form_fields[key] = 'True' if value else 'False'
        elif isinstance(value, (int, float)):
            form_fields[key] = str(value)
        else:
            form_fields[key] = value
    hd_headers = {'Authorization': 'Bearer ' + HOMEDESIGNS_TOKEN}
    try:
        resp = requests.post(
            f'https://homedesigns.ai/api/v2/{endpoint}',
            headers=hd_headers,
            data=form_fields,
            timeout=120
        )
        try:
            return jsonify(resp.json()), resp.status_code
        except Exception:
            return jsonify({'success': False, 'message': 'Invalid response from upstream'}), resp.status_code
    except requests.Timeout:
        return jsonify({'success': False, 'message': 'Timeout (120s)'}), 504
    except Exception:
        return jsonify({'success': False, 'message': 'Service unavailable'}), 502

# ── design_advisor ────────────────────────────────────────────────────
@app.route('/api/homedesigns/advisor', methods=['POST', 'OPTIONS'])
def homedesigns_advisor():
    if request.method == 'OPTIONS': return '', 204
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip()
    if not rate_limit('advisor:' + ip, 10, 60):
        return jsonify({'error': 'Too many requests'}), 429
    data = request.get_json(force=True) or {}
    hd_headers = {'Authorization': 'Bearer ' + HOMEDESIGNS_TOKEN}
    try:
        msg = data.get('message', '')
        if not isinstance(msg, str) or len(msg) > 2000:
            return jsonify({'error': 'Message too long'}), 400
        msg_ru = msg + '\n\nПожалуйста, ответь на русском языке.'
        resp = requests.post(
            'https://homedesigns.ai/api/v2/design_advisor',
            headers=hd_headers,
            data={'custom_message': msg_ru},
            timeout=30
        )
        try:
            return jsonify(resp.json()), resp.status_code
        except Exception:
            return jsonify({'success': False, 'message': 'Invalid response from upstream'}), resp.status_code
    except Exception:
        return jsonify({'success': False, 'message': 'Service unavailable'}), 502

@app.route('/api/proxy-image', methods=['GET'])
def proxy_image():
    """Fetch external image (from homedesigns.ai results) and return with CORS headers."""
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip()
    if not rate_limit('img:' + ip, 60, 60):
        return jsonify({'error': 'Too many requests'}), 429
    url = request.args.get('url', '')
    if not url.startswith('https://'):
        return jsonify({'error': 'invalid url'}), 400
    parsed = urlparse(url)
    if parsed.hostname not in PROXY_IMAGE_ALLOWED_DOMAINS:
        return jsonify({'error': 'Domain not allowed'}), 403
    try:
        resp = requests.get(url, timeout=30, allow_redirects=False)
        if resp.status_code != 200:
            return jsonify({'error': 'Image not available'}), 502
        content_type = resp.headers.get('content-type', 'image/png')
        if not content_type.startswith('image/'):
            return jsonify({'error': 'Not an image'}), 400
        r = FlaskResponse(resp.content, content_type=content_type)
        r.headers['X-Content-Type-Options'] = 'nosniff'
        origin = request.headers.get('Origin', '')
        if origin in ALLOWED_ORIGINS:
            r.headers['Access-Control-Allow-Origin'] = origin
        return r
    except Exception:
        return jsonify({'error': 'Failed to fetch image'}), 502

# ── Partners & Requests ──────────────────────────────────────────────
@app.route('/api/partners', methods=['GET', 'OPTIONS'])
def get_partners():
    if request.method == 'OPTIONS': return '', 204
    room_type = request.args.get('type', '')
    partners = [p for p in load_partners() if p.get('active')]
    if room_type:
        partners = [p for p in partners if room_type in p.get('specialization', [])]
    safe = []
    for p in partners:
        safe.append({
            'id': p['id'], 'name': p['name'], 'icon': p.get('icon', ''),
            'specialization': p.get('specialization', []),
            'description': p.get('description', ''),
            'price_from': p.get('price_from', ''),
            'rating': p.get('rating', 0), 'reviews': p.get('reviews', 0)
        })
    return jsonify(safe)

@app.route('/api/request', methods=['POST', 'OPTIONS'])
def create_request():
    if request.method == 'OPTIONS': return '', 204
    ip = request.headers.get('X-Real-IP', request.remote_addr or '')
    ok, msg = check_request_rate_limit(ip)
    if not ok:
        return jsonify({'error': msg}), 429
    data = request.get_json(force=True) or {}
    email = (data.get('email') or '').strip()
    name  = (data.get('name') or '').strip()
    phone = (data.get('phone') or '').strip()
    if not email or '@' not in email:
        return jsonify({'error': 'Email обязателен'}), 400
    if not name:
        return jsonify({'error': 'Укажите имя'}), 400
    if data.get('website'):
        return jsonify({'error': 'spam'}), 400
    rid         = secrets.token_urlsafe(8)
    user_token  = secrets.token_urlsafe(16)
    render_url  = data.get('render_url', '')
    if render_url and render_url.startswith('data:'):
        saved = save_base64_image(render_url)
        if saved:
            render_url = saved
    partner_ids = data.get('partners', [])
    if not partner_ids:
        partner_ids = [p['id'] for p in load_partners() if p.get('active')]
    partner_tokens = {pid: secrets.token_urlsafe(12) for pid in partner_ids}
    req_obj = {
        'id': rid, 'user_token': user_token,
        'created': datetime.utcnow().isoformat() + 'Z',
        'status': 'sent',
        'user': {'name': name, 'phone': phone, 'email': email},
        'room_type': data.get('room_type', ''),
        'area': data.get('area', ''),
        'style': data.get('style', ''),
        'wishes': data.get('wishes', ''),
        'render_url': render_url,
        'action_kit': data.get('action_kit', []),
        'source_page': data.get('source_page', ''),
        'partners_sent': partner_ids,
        'partner_tokens': partner_tokens,
        'responses': {}, 'chosen': None, 'ip': ip
    }
    save_request(req_obj)
    _req_rate_limits.setdefault(ip, []).append(time.time())
    try:
        requests.post('https://n8n.morrowlab.by/webhook/new-request', json={
            'event': 'new_request', 'request_id': rid,
            'user_name': name, 'user_email': email, 'user_phone': phone,
            'room_type': req_obj['room_type'], 'area': req_obj['area'],
            'style': req_obj['style'], 'wishes': req_obj['wishes'],
            'render_url': render_url, 'partners': partner_ids,
            'partner_tokens': partner_tokens,
            'status_url': 'https://morrowlab.by/r/?id=' + rid + '&token=' + user_token
        }, timeout=5)
    except Exception:
        pass
    return jsonify({
        'success': True, 'request_id': rid,
        'status_url': '/r/?id=' + rid + '&token=' + user_token,
        'partners_count': len(partner_ids)
    })

@app.route('/api/request/<rid>', methods=['GET', 'OPTIONS'])
def get_request_status(rid):
    if request.method == 'OPTIONS': return '', 204
    token = request.args.get('token', '')
    req = load_request(rid)
    if not req:
        return jsonify({'error': 'Заявка не найдена'}), 404
    if req.get('user_token') != token:
        return jsonify({'error': 'Неверный токен'}), 403
    all_partners = {p['id']: p for p in load_partners()}
    partners_info = []
    for pid in req.get('partners_sent', []):
        p = all_partners.get(pid, {})
        resp = req.get('responses', {}).get(pid)
        partners_info.append({
            'id': pid, 'name': p.get('name', pid), 'icon': p.get('icon', ''),
            'status': 'responded' if resp else 'waiting', 'response': resp
        })
    return jsonify({
        'id': req['id'], 'created': req['created'], 'status': req['status'],
        'room_type': req.get('room_type', ''), 'area': req.get('area', ''),
        'style': req.get('style', ''), 'wishes': req.get('wishes', ''),
        'render_url': req.get('render_url', ''), 'action_kit': req.get('action_kit', []),
        'partners': partners_info
    })

@app.route('/api/request/<rid>/reply', methods=['POST', 'OPTIONS'])
def partner_reply(rid):
    if request.method == 'OPTIONS': return '', 204
    data = request.get_json(force=True) or {}
    partner_token = data.get('token', '')
    req = load_request(rid)
    if not req:
        return jsonify({'error': 'Заявка не найдена'}), 404
    partner_id = None
    for pid, tok in req.get('partner_tokens', {}).items():
        if tok == partner_token:
            partner_id = pid
            break
    if not partner_id:
        return jsonify({'error': 'Неверный токен партнёра'}), 403
    response_data = {
        'price': data.get('price', ''), 'days': data.get('days', ''),
        'comment': data.get('comment', ''),
        'responded_at': datetime.utcnow().isoformat() + 'Z'
    }
    if 'responses' not in req:
        req['responses'] = {}
    req['responses'][partner_id] = response_data
    req['status'] = 'all_responded' if all(
        req['responses'].get(p) for p in req['partners_sent']
    ) else 'has_responses'
    save_request(req)
    try:
        all_partners = {p['id']: p for p in load_partners()}
        requests.post('https://n8n.morrowlab.by/webhook/partner-replied', json={
            'event': 'partner_replied', 'request_id': rid,
            'partner_id': partner_id,
            'partner_name': all_partners.get(partner_id, {}).get('name', partner_id),
            'price': response_data['price'], 'days': response_data['days'],
            'user_email': req['user']['email'],
            'status_url': 'https://morrowlab.by/r/?id=' + rid + '&token=' + req['user_token']
        }, timeout=5)
    except Exception:
        pass
    return jsonify({'success': True, 'message': 'Оценка отправлена'})

@app.route('/api/request/<rid>/choose', methods=['POST', 'OPTIONS'])
def choose_partner(rid):
    if request.method == 'OPTIONS': return '', 204
    data = request.get_json(force=True) or {}
    token = data.get('user_token', '')
    partner_id = data.get('partner_id', '')
    req = load_request(rid)
    if not req:
        return jsonify({'error': 'Заявка не найдена'}), 404
    if req.get('user_token') != token:
        return jsonify({'error': 'Неверный токен'}), 403
    req['chosen'] = partner_id
    req['status'] = 'chosen'
    save_request(req)
    try:
        requests.post('https://n8n.morrowlab.by/webhook/partner-chosen', json={
            'event': 'partner_chosen', 'request_id': rid, 'partner_id': partner_id,
            'user_name': req['user']['name'], 'user_phone': req['user']['phone'],
            'user_email': req['user']['email']
        }, timeout=5)
    except Exception:
        pass
    return jsonify({'success': True})

@app.route('/api/request/<rid>/view', methods=['GET', 'OPTIONS'])
def view_request(rid):
    """Partner views full request details (by partner_token)."""
    if request.method == 'OPTIONS': return '', 204
    token = request.args.get('token', '')
    req = load_request(rid)
    if not req:
        return jsonify({'error': 'Заявка не найдена'}), 404
    partner_id = None
    for pid, tok in req.get('partner_tokens', {}).items():
        if tok == token:
            partner_id = pid
            break
    if not partner_id:
        return jsonify({'error': 'Неверный токен'}), 403
    return jsonify({
        'id': req['id'], 'created': req['created'], 'status': req['status'],
        'room_type': req.get('room_type', ''), 'area': req.get('area', ''),
        'style': req.get('style', ''), 'wishes': req.get('wishes', ''),
        'render_url': req.get('render_url', ''),
        'action_kit': req.get('action_kit', []),
        'user_attachments': req.get('user_attachments', []),
        'my_response': req.get('responses', {}).get(partner_id),
        'is_chosen': req.get('chosen') == partner_id
    })

# ── OTP Auth ─────────────────────────────────────────────────────────
@app.route('/api/auth/send-code', methods=['POST', 'OPTIONS'])
def auth_send_code():
    if request.method == 'OPTIONS': return '', 204
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip()
    if not rate_limit('otp:' + ip, 10, 60):
        return jsonify({'error': 'Too many requests'}), 429
    data = request.get_json(force=True) or {}
    email = (data.get('email') or '').strip().lower()
    role  = data.get('role', 'user')
    if not email or '@' not in email or len(email) > 254:
        return jsonify({'error': 'Invalid email'}), 400
    if role not in ('user', 'partner'):
        role = 'user'
    existing = OTP_STORE.get(email)
    if existing and existing['expires'] > datetime.utcnow():
        age = (datetime.utcnow() - existing.get('created', datetime.utcnow())).total_seconds()
        if age < 60:
            return jsonify({'error': 'Code already sent. Wait 60 seconds.'}), 429
    if role == 'partner':
        found = any(p.get('email', '').lower() == email for p in load_partners())
        if not found:
            return jsonify({'error': 'Partner email not found'}), 404
    otp = generate_otp()
    OTP_STORE[email] = {
        'code': otp, 'role': role,
        'expires': datetime.utcnow() + timedelta(minutes=10),
        'created': datetime.utcnow(), 'attempts': 0
    }
    html = (
        '<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px">'
        '<h2 style="color:#000">Morrow Lab</h2>'
        '<p>Ваш код для входа:</p>'
        '<div style="font-size:32px;font-weight:900;letter-spacing:8px;padding:20px;'
        'background:#f5f5f5;border-radius:12px;text-align:center;margin:16px 0">'
        + otp +
        '</div>'
        '<p style="color:#888;font-size:13px">Код действителен 10 минут.</p>'
        '</div>'
    )
    ok = send_email(email, f'Код для входа: {otp} — Morrow Lab', html)
    if not ok:
        del OTP_STORE[email]
        return jsonify({'error': 'Не удалось отправить email. Проверьте адрес или попробуйте позже.'}), 500
    return jsonify({'success': True, 'message': 'Code sent'})

@app.route('/api/auth/verify-code', methods=['POST', 'OPTIONS'])
def auth_verify_code():
    if request.method == 'OPTIONS': return '', 204
    data = request.get_json(force=True) or {}
    email = (data.get('email') or '').strip().lower()
    code  = (data.get('code') or '').strip()
    if not email or not code:
        return jsonify({'error': 'Email and code required'}), 400
    otp_data = OTP_STORE.get(email)
    if not otp_data:
        return jsonify({'error': 'No code sent for this email'}), 400
    if otp_data['expires'] < datetime.utcnow():
        del OTP_STORE[email]
        return jsonify({'error': 'Code expired'}), 400
    if otp_data['attempts'] >= 5:
        del OTP_STORE[email]
        return jsonify({'error': 'Too many attempts'}), 429
    otp_data['attempts'] += 1
    if otp_data['code'] != code:
        remaining = 5 - otp_data['attempts']
        return jsonify({'error': f'Wrong code. {remaining} attempts left.'}), 400
    role = otp_data.get('role', 'user')
    partner_id = None
    if role == 'partner':
        for p in load_partners():
            if p.get('email', '').lower() == email:
                partner_id = p['id']
                break
    try:
        token = create_jwt_token(email, role, partner_id)
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 500
    del OTP_STORE[email]
    resp = jsonify({'success': True, 'role': role, 'email': email})
    resp.set_cookie('ml_session', token, max_age=30*24*3600,
                    httponly=True, samesite='Lax', secure=True, path='/')
    return resp

@app.route('/api/auth/logout', methods=['POST', 'OPTIONS'])
def auth_logout():
    if request.method == 'OPTIONS': return '', 204
    resp = jsonify({'success': True})
    resp.delete_cookie('ml_session', path='/')
    return resp

@app.route('/api/auth/me', methods=['GET', 'OPTIONS'])
def auth_me():
    if request.method == 'OPTIONS': return '', 204
    auth = get_auth_from_cookie()
    if not auth:
        return jsonify({'authenticated': False}), 401
    return jsonify({
        'authenticated': True, 'email': auth['email'],
        'role': auth.get('role', 'user'), 'partner_id': auth.get('partner_id')
    })

@app.route('/api/my/requests', methods=['GET', 'OPTIONS'])
def my_requests():
    if request.method == 'OPTIONS': return '', 204
    auth = get_auth_from_cookie()
    if not auth:
        return jsonify({'error': 'Not authenticated'}), 401
    email = auth['email']
    result = []
    all_partners = {p['id']: p for p in load_partners()}
    for fname in sorted(os.listdir(REQUESTS_DIR), reverse=True):
        if not fname.endswith('.json'):
            continue
        try:
            with open(os.path.join(REQUESTS_DIR, fname), 'r', encoding='utf-8') as f:
                req = json.load(f)
        except Exception:
            continue
        if req.get('user', {}).get('email', '').lower() != email:
            continue
        partners_info = []
        for pid in req.get('partners_sent', []):
            p = all_partners.get(pid, {})
            resp = req.get('responses', {}).get(pid)
            partners_info.append({
                'id': pid, 'name': p.get('name', pid), 'icon': p.get('icon', ''),
                'status': 'responded' if resp else 'waiting', 'response': resp
            })
        result.append({
            'id': req['id'], 'created': req.get('created', ''),
            'status': req.get('status', ''), 'room_type': req.get('room_type', ''),
            'area': req.get('area', ''), 'style': req.get('style', ''),
            'wishes': req.get('wishes', ''), 'render_url': req.get('render_url', ''),
            'user_token': req.get('user_token', ''), 'partners': partners_info,
            'chosen': req.get('chosen', ''),
            'user_attachments': req.get('user_attachments', []),
            'responses_count': len(req.get('responses', {})),
            'partners_count': len(req.get('partners_sent', []))
        })
    return jsonify({'requests': result, 'email': email})

@app.route('/api/partner/requests', methods=['GET', 'OPTIONS'])
def partner_requests():
    if request.method == 'OPTIONS': return '', 204
    auth = get_auth_from_cookie()
    if not auth or auth.get('role') != 'partner':
        return jsonify({'error': 'Not authenticated as partner'}), 401
    partner_id = auth.get('partner_id')
    email = auth['email']
    if not partner_id:
        for p in load_partners():
            if p.get('email', '').lower() == email:
                partner_id = p['id']
                break
    if not partner_id:
        return jsonify({'error': 'Partner not found'}), 404
    result = []
    for fname in sorted(os.listdir(REQUESTS_DIR), reverse=True):
        if not fname.endswith('.json'):
            continue
        try:
            with open(os.path.join(REQUESTS_DIR, fname), 'r', encoding='utf-8') as f:
                req = json.load(f)
        except Exception:
            continue
        if partner_id not in req.get('partners_sent', []):
            continue
        my_response = req.get('responses', {}).get(partner_id)
        is_chosen = req.get('chosen') == partner_id
        result.append({
            'id': req['id'], 'created': req.get('created', ''),
            'status': req.get('status', ''), 'room_type': req.get('room_type', ''),
            'area': req.get('area', ''), 'style': req.get('style', ''),
            'wishes': req.get('wishes', ''), 'render_url': req.get('render_url', ''),
            'user_attachments': req.get('user_attachments', []),
            'my_response': my_response,
            'my_token': req.get('partner_tokens', {}).get(partner_id, ''),
            'is_chosen': is_chosen,
            'user_name':  req['user']['name']  if is_chosen else '',
            'user_phone': req['user']['phone'] if is_chosen else '',
            'user_email': req['user']['email'] if is_chosen else ''
        })
    return jsonify({'requests': result, 'partner_id': partner_id})

# ── Admin ─────────────────────────────────────────────────────────────
@app.route('/api/admin/requests', methods=['GET', 'OPTIONS'])
def admin_requests():
    if request.method == 'OPTIONS': return '', 204
    if not check_admin_auth():
        return jsonify({'error': 'unauthorized'}), 401
    reqs = []
    for fname in sorted(os.listdir(REQUESTS_DIR), reverse=True):
        if fname.endswith('.json'):
            try:
                with open(os.path.join(REQUESTS_DIR, fname), 'r', encoding='utf-8') as f:
                    reqs.append(json.load(f))
            except Exception:
                pass
    return jsonify(reqs)

@app.route('/api/admin/partners', methods=['GET', 'POST', 'OPTIONS'])
def admin_partners():
    if request.method == 'OPTIONS': return '', 204
    if not check_admin_auth():
        return jsonify({'error': 'unauthorized'}), 401
    if request.method == 'GET':
        return jsonify(load_partners())
    data = request.get_json(force=True) or {}
    partners = data.get('partners', [])
    with open(PARTNERS_FILE, 'w', encoding='utf-8') as f:
        json.dump({'partners': partners}, f, ensure_ascii=False, indent=2)
    return jsonify({'success': True, 'count': len(partners)})

# ── Moodboard: AI style analysis via Groq vision ─────────────────────
@app.route('/api/moodboard', methods=['POST', 'OPTIONS'])
def api_moodboard():
    if request.method == 'OPTIONS': return '', 204
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip()
    if not rate_limit('moodboard:' + ip, 5, 60):
        return jsonify({'error': 'Too many requests'}), 429
    if not GROQ_API_KEY:
        return jsonify({'error': 'AI service not configured'}), 503
    data = request.get_json(force=True) or {}
    image_b64 = data.get('image', '')
    if not image_b64 or not isinstance(image_b64, str) or len(image_b64) > 13_500_000:
        return jsonify({'error': 'Invalid image'}), 400
    # Extract MIME type and base64 data from data URL
    img_mime = 'image/jpeg'
    if ',' in image_b64:
        header, img_data = image_b64.split(',', 1)
        if 'image/png' in header: img_mime = 'image/png'
        elif 'image/webp' in header: img_mime = 'image/webp'
        elif 'image/gif' in header: img_mime = 'image/gif'
    else:
        img_data = image_b64
    try:
        decoded = base64.b64decode(img_data, validate=True)
        if len(decoded) > 10 * 1024 * 1024:
            return jsonify({'error': 'Image too large'}), 400
    except Exception:
        return jsonify({'error': 'Invalid image data'}), 400
    prompt = (
        'Analyze this interior/exterior design image. Return ONLY a JSON object with these fields:\n'
        '- style_name: main style in Russian (e.g. "Минимализм", "Скандинавский", "Лофт", "Современный")\n'
        '- description: 2-3 sentences in Russian about the style\n'
        '- matching_styles: array of 3-4 related style names in Russian\n'
        '- palette: array of 4-6 dominant hex color codes from the image (e.g. ["#f5f0e8","#3a2e1c"])\n'
        '- palette_names: array of color names in Russian for each hex code\n'
        'Return ONLY valid JSON, no markdown, no extra text.'
    )
    try:
        resp = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={'Authorization': 'Bearer ' + GROQ_API_KEY, 'Content-Type': 'application/json'},
            json={
                'model': 'meta-llama/llama-4-scout-17b-16e-instruct',
                'messages': [{'role': 'user', 'content': [
                    {'type': 'image_url', 'image_url': {'url': f'data:{img_mime};base64,{img_data}'}},
                    {'type': 'text', 'text': prompt}
                ]}],
                'max_tokens': 800,
                'temperature': 0.3
            },
            timeout=30
        )
        if resp.status_code != 200:
            return jsonify({'error': 'AI service error'}), 502
        content = resp.json()['choices'][0]['message']['content'].strip()
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            return jsonify(json.loads(json_match.group()))
        return jsonify({'raw': content})
    except Exception:
        return jsonify({'error': 'Service error'}), 502

# ── AI Consultant (renovation advisor via Groq) ───────────────────────
@app.route('/api/consultant', methods=['POST', 'OPTIONS'])
def api_consultant():
    if request.method == 'OPTIONS': return '', 204
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip()
    if not rate_limit('consultant:' + ip, 20, 60):
        return jsonify({'error': 'Too many requests'}), 429
    if not GROQ_API_KEY:
        return jsonify({'error': 'AI service not configured'}), 503
    data = request.get_json(force=True) or {}
    message = data.get('message', '')
    history = data.get('history', [])
    if not isinstance(message, str) or not message.strip() or len(message) > 2000:
        return jsonify({'error': 'Invalid message'}), 400
    if not isinstance(history, list):
        history = []
    history = history[-20:]
    system_prompt = (
        'Ты — AI-консультант по дизайну интерьеров и ремонту для платформы Morrow Lab (morrowlab.by). '
        'Отвечай на русском языке, кратко и по существу. '
        'Помогаешь подобрать материалы, стили, планировки, оцениваешь стоимость ремонта в BYN.'
    )
    messages = [{'role': 'system', 'content': system_prompt}]
    for h in history[-6:]:
        if isinstance(h, dict) and h.get('role') in ('user', 'assistant') and isinstance(h.get('content'), str):
            messages.append({'role': h['role'], 'content': h['content'][:1000]})
    messages.append({'role': 'user', 'content': message})
    try:
        resp = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={'Authorization': 'Bearer ' + GROQ_API_KEY, 'Content-Type': 'application/json'},
            json={'model': 'llama-3.3-70b-versatile', 'messages': messages, 'max_tokens': 600, 'temperature': 0.7},
            timeout=30
        )
        if resp.status_code != 200:
            return jsonify({'error': 'AI service error'}), 502
        reply = resp.json()['choices'][0]['message']['content']
        return jsonify({'reply': reply})
    except Exception:
        return jsonify({'error': 'Service error'}), 502

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=3030)
