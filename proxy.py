from flask import Flask, request, jsonify
import requests, base64, uuid, os, re

app = Flask(__name__)

REPLICATE_TOKEN   = '***REDACTED_REPLICATE_TOKEN***'
HOMEDESIGNS_TOKEN = '***REDACTED_HOMEDESIGNS_TOKEN***'

REPLICATE_HDRS = {'Authorization': 'Token ' + REPLICATE_TOKEN, 'Content-Type': 'application/json'}

UPLOAD_DIR = '/var/www/constructor.zenohome.by/uploads'
UPLOAD_URL = 'https://constructor.zenohome.by/uploads'
os.makedirs(UPLOAD_DIR, exist_ok=True)

def cors(r):
    r.headers['Access-Control-Allow-Origin'] = '*'
    r.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    r.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return r

app.after_request(cors)

def save_base64_image(data_url):
    """Save base64 data URI to uploads dir, return public URL."""
    m = re.match(r'data:(image/[\w+]+);base64,(.+)', data_url, re.DOTALL)
    if not m:
        return None
    ext = m.group(1).split('/')[-1].replace('jpeg', 'jpg')
    img_bytes = base64.b64decode(m.group(2))
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
    inp = data.get('input', {})
    # Convert base64 image → hosted URL
    if isinstance(inp.get('image'), str) and inp['image'].startswith('data:'):
        url = save_base64_image(inp['image'])
        if url:
            inp['image'] = url
    resp = requests.post(
        'https://api.replicate.com/v1/predictions',
        json=data, headers=REPLICATE_HDRS, timeout=30
    )
    return jsonify(resp.json()), resp.status_code

@app.route('/api/replicate/<pred_id>', methods=['GET'])
def replicate_status(pred_id):
    resp = requests.get(
        'https://api.replicate.com/v1/predictions/' + pred_id,
        headers=REPLICATE_HDRS, timeout=30
    )
    return jsonify(resp.json()), resp.status_code

# ── homedesigns.ai generic v2 proxy ──────────────────────────────────
# Sends ALL fields (including base64 images) as form-data STRING values.
# The API accepts "base64 Image string" directly — no file upload needed.

@app.route('/api/homedesigns/v2/<path:endpoint>', methods=['POST', 'OPTIONS'])
def homedesigns_v2(endpoint):
    if request.method == 'OPTIONS': return '', 204
    data = request.get_json(force=True) or {}
    form_fields = {}
    for key, value in data.items():
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
            return jsonify({'success': False, 'message': resp.text[:300]}), resp.status_code
    except requests.Timeout:
        return jsonify({'success': False, 'message': 'Timeout (120s)'}), 504
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

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
            return jsonify({'success': False, 'message': resp.text[:300]}), resp.status_code
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/proxy-image', methods=['GET'])
def proxy_image():
    """Fetch external image (from homedesigns.ai results) and return with CORS headers."""
    url = request.args.get('url', '')
    if not url.startswith('https://'):
        return jsonify({'error': 'invalid url'}), 400
    try:
        resp = requests.get(url, timeout=30)
        from flask import Response as FlaskResponse
        r = FlaskResponse(resp.content, content_type=resp.headers.get('content-type', 'image/png'))
        r.headers['Access-Control-Allow-Origin'] = '*'
        return r
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=3030)
