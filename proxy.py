from flask import Flask, request, jsonify
import requests, base64, uuid, os, re
from urllib.parse import urlparse

app = Flask(__name__)

REPLICATE_TOKEN   = os.environ.get('REPLICATE_TOKEN', '')
HOMEDESIGNS_TOKEN = os.environ.get('HOMEDESIGNS_TOKEN', '')

if not REPLICATE_TOKEN or not HOMEDESIGNS_TOKEN:
    import sys
    print("FATAL: REPLICATE_TOKEN and/or HOMEDESIGNS_TOKEN not set in environment", file=sys.stderr)
    sys.exit(1)

REPLICATE_HDRS = {'Authorization': 'Token ' + REPLICATE_TOKEN, 'Content-Type': 'application/json'}

UPLOAD_DIR = '/var/www/constructor.zenohome.by/uploads'
UPLOAD_URL = 'https://constructor.zenohome.by/uploads'
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Security: CORS allowlist ──
ALLOWED_ORIGINS = {
    'https://morrowlab.by',
    'https://www.morrowlab.by',
    'https://constructor.morrowlab.by',
    'https://zenohome.by',
    'https://www.zenohome.by',
    'https://constructor.zenohome.by',
}

def cors(r):
    origin = request.headers.get('Origin', '')
    if origin in ALLOWED_ORIGINS:
        r.headers['Access-Control-Allow-Origin'] = origin
        r.headers['Access-Control-Allow-Credentials'] = 'true'
    r.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    r.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return r

app.after_request(cors)

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
}

# ── Security: HomeDesigns allowed form fields ──
HOMEDESIGNS_ALLOWED_FIELDS = {
    'image', 'image_url', 'mask', 'mask_url', 'prompt', 'negative_prompt',
    'room_type', 'design_style', 'design_theme', 'num_images', 'resolution',
    'mode', 'scale', 'seed', 'strength', 'guidance_scale',
    'custom_message', 'color_scheme', 'material', 'furniture_style',
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
        'gif': b'GIF8', 'webp': b'RIFF',
    }
    if ext in MAGIC and not img_bytes[:len(MAGIC[ext])].startswith(MAGIC[ext]):
        return None
    filename = str(uuid.uuid4()) + '.' + ext
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, 'wb') as f:
        f.write(img_bytes)
    return UPLOAD_URL + '/' + filename

# ── Replicate ────────────────────────────────────────────────────────
# Auto-converts base64 image inputs to hosted URLs before sending to Replicate
# (Grounding DINO returns empty results with base64, needs URL)

@app.route('/api/replicate', methods=['POST', 'OPTIONS'])
def replicate_create():
    if request.method == 'OPTIONS': return '', 204
    data = request.get_json(force=True) or {}
    # Validate: must have 'version' field
    if 'version' not in data:
        return jsonify({'error': 'version field is required'}), 400
    inp = data.get('input', {})
    # Convert base64 image → hosted URL
    if isinstance(inp.get('image'), str) and inp['image'].startswith('data:'):
        url = save_base64_image(inp['image'])
        if url:
            inp['image'] = url
    # Only forward safe fields
    safe_data = {
        'version': data['version'],
        'input': inp,
    }
    if 'webhook' in data:
        wh_parsed = urlparse(data['webhook'])
        if wh_parsed.hostname and any(
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
    # Validate prediction ID format (alphanumeric, reasonable length)
    if not re.match(r'^[a-z0-9]{10,40}$', pred_id):
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
# Sends ALL fields (including base64 images) as form-data STRING values.
# The API accepts "base64 Image string" directly — no file upload needed.

@app.route('/api/homedesigns/v2/<path:endpoint>', methods=['POST', 'OPTIONS'])
def homedesigns_v2(endpoint):
    if request.method == 'OPTIONS': return '', 204
    # Security: restrict to known endpoints
    if endpoint not in HOMEDESIGNS_ALLOWED_ENDPOINTS:
        return jsonify({'error': 'Unknown endpoint'}), 400
    data = request.get_json(force=True) or {}
    form_fields = {}
    for key, value in data.items():
        # Security: only forward known fields to upstream API
        if key not in HOMEDESIGNS_ALLOWED_FIELDS:
            continue
        if isinstance(value, bool):
            form_fields[key] = 'True' if value else 'False'
        elif isinstance(value, (int, float)):
            form_fields[key] = str(value)
        else:
            form_fields[key] = value   # base64 strings sent as-is
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
    data = request.get_json(force=True) or {}
    hd_headers = {'Authorization': 'Bearer ' + HOMEDESIGNS_TOKEN}
    try:
        msg = data.get('message', '')
        # Force Russian response
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
    url = request.args.get('url', '')
    if not url.startswith('https://'):
        return jsonify({'error': 'invalid url'}), 400
    # Security: SSRF protection — only allow known domains
    parsed = urlparse(url)
    if parsed.hostname not in PROXY_IMAGE_ALLOWED_DOMAINS:
        return jsonify({'error': 'Domain not allowed'}), 403
    try:
        resp = requests.get(url, timeout=30, allow_redirects=False)
        from flask import Response as FlaskResponse
        content_type = resp.headers.get('content-type', 'image/png')
        # Only proxy image content types
        if not content_type.startswith(('image/', 'application/octet-stream')):
            return jsonify({'error': 'Not an image'}), 400
        r = FlaskResponse(resp.content, content_type=content_type)
        origin = request.headers.get('Origin', '')
        if origin in ALLOWED_ORIGINS:
            r.headers['Access-Control-Allow-Origin'] = origin
        return r
    except Exception:
        return jsonify({'error': 'Failed to fetch image'}), 502

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=3030)
