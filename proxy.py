from flask import Flask, request, jsonify
import requests, base64, uuid, os, re

app = Flask(__name__)

REPLICATE_TOKEN   = '***REDACTED_REPLICATE_TOKEN***'
HOMEDESIGNS_TOKEN = '***REDACTED_HOMEDESIGNS_TOKEN***'

REPLICATE_HDRS = {'Authorization': 'Token ' + REPLICATE_TOKEN, 'Content-Type': 'application/json'}

UPLOAD_DIR = '/var/www/constructor.zenohome.by/uploads'
UPLOAD_URL = 'https://constructor.zenohome.by/uploads'
os.makedirs(UPLOAD_DIR, exist_ok=True)

IMAGE_KEYS = ['image', 'masked_image', 'texture_image', 'color_image']

def cors(r):
    r.headers['Access-Control-Allow-Origin'] = '*'
    r.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    r.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return r

app.after_request(cors)

def b64_to_bytes(data_url):
    """Convert base64 data URI → (bytes, extension)"""
    m = re.match(r'data:(image/[\w+]+);base64,(.+)', data_url, re.DOTALL)
    if not m:
        return None, None
    ext = m.group(1).split('/')[-1].replace('jpeg', 'jpg')
    return base64.b64decode(m.group(2)), ext

def save_base64_image(data_url):
    img_bytes, ext = b64_to_bytes(data_url)
    if not img_bytes:
        return None
    filename = str(uuid.uuid4()) + '.' + ext
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, 'wb') as f:
        f.write(img_bytes)
    return UPLOAD_URL + '/' + filename

# ── Replicate ────────────────────────────────────────────────────────

@app.route('/api/replicate', methods=['POST', 'OPTIONS'])
def replicate_create():
    if request.method == 'OPTIONS': return '', 204
    resp = requests.post(
        'https://api.replicate.com/v1/predictions',
        json=request.get_json(),
        headers=REPLICATE_HDRS,
        timeout=30
    )
    return jsonify(resp.json()), resp.status_code

@app.route('/api/replicate/<pred_id>', methods=['GET'])
def replicate_status(pred_id):
    resp = requests.get(
        'https://api.replicate.com/v1/predictions/' + pred_id,
        headers=REPLICATE_HDRS,
        timeout=30
    )
    return jsonify(resp.json()), resp.status_code

# ── homedesigns.ai generic v2 proxy ──────────────────────────────────
# Accepts JSON from frontend {image: "data:...", masked_image: "data:...", ...other fields}
# Converts to multipart/form-data for homedesigns.ai API

@app.route('/api/homedesigns/v2/<path:endpoint>', methods=['POST', 'OPTIONS'])
def homedesigns_v2(endpoint):
    if request.method == 'OPTIONS': return '', 204

    data = request.get_json(force=True) or {}
    form_fields = {}
    files = {}

    for key, value in data.items():
        if key in IMAGE_KEYS and isinstance(value, str) and value.startswith('data:'):
            img_bytes, ext = b64_to_bytes(value)
            if img_bytes:
                mime = 'image/jpeg' if ext in ('jpg', 'jpeg') else 'image/png'
                files[key] = (f'{key}.{ext}', img_bytes, mime)
        else:
            form_fields[key] = str(value) if not isinstance(value, str) else value

    hd_headers = {'Authorization': 'Bearer ' + HOMEDESIGNS_TOKEN}

    try:
        if files:
            resp = requests.post(
                f'https://homedesigns.ai/api/v2/{endpoint}',
                headers=hd_headers,
                data=form_fields,
                files=files,
                timeout=120
            )
        else:
            resp = requests.post(
                f'https://homedesigns.ai/api/v2/{endpoint}',
                headers=hd_headers,
                data=form_fields,
                timeout=120
            )

        try:
            return jsonify(resp.json()), resp.status_code
        except Exception:
            return jsonify({'success': False, 'message': resp.text[:300]}), resp.status_code

    except requests.Timeout:
        return jsonify({'success': False, 'message': 'Превышено время ожидания (120 сек)'}), 504
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ── design_advisor (text only, no images) ────────────────────────────

@app.route('/api/homedesigns/advisor', methods=['POST', 'OPTIONS'])
def homedesigns_advisor():
    if request.method == 'OPTIONS': return '', 204
    data = request.get_json(force=True) or {}
    hd_headers = {'Authorization': 'Bearer ' + HOMEDESIGNS_TOKEN}
    try:
        resp = requests.post(
            'https://homedesigns.ai/api/v2/design_advisor',
            headers=hd_headers,
            data={'custom_message': data.get('message', '')},
            timeout=30
        )
        try:
            return jsonify(resp.json()), resp.status_code
        except Exception:
            return jsonify({'success': False, 'message': resp.text[:300]}), resp.status_code
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=3030)
