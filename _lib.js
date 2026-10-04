// YEW shared helpers — plain Node, zero dependencies.
// Every /api function loads this with require('./_lib').

function env(name, required = true) {
  const v = process.env[name];
  if (required && !v) throw new Error('Missing env var ' + name);
  return v || '';
}

// Read the raw request body, then parse it as JSON or form-encoded
// (Twilio webhooks always post form-encoded).
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) req.destroy(); // sanity cap
    });
    req.on('end', () => {
      try {
        const ct = String(req.headers['content-type'] || '').toLowerCase();
        if (ct.includes('application/json')) return resolve(data ? JSON.parse(data) : {});
        if (ct.includes('application/x-www-form-urlencoded')) {
          return resolve(require('querystring').parse(data));
        }
        if (data.trim().startsWith('{')) return resolve(JSON.parse(data));
        if (data) return resolve(require('querystring').parse(data));
        return resolve({});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Minimal Supabase REST client using the service-role key.
// Writes bypass RLS, so never expose these endpoints publicly without checks.
function sb() {
  const url = env('SUPABASE_URL').replace(/\/$/, '');
  const key = env('SUPABASE_SERVICE_KEY');

  async function call(method, path, { params, body } = {}) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const r = await fetch(`${url}/rest/v1/${path}${qs}`, {
      method,
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    if (!r.ok) {
      throw new Error(`Supabase ${method} ${path} -> ${r.status} ${text.slice(0, 300)}`);
    }
    return text ? JSON.parse(text) : null;
  }

  return {
    get: (table, params) => call('GET', table, { params }),
    insert: (table, rows) => call('POST', table, { body: rows }),
    // IMPORTANT: always pass restrictive params (e.g. { id: 'eq.<uuid>' }).
    patch: (table, params, patch) => call('PATCH', table, { params, body: patch }),
  };
}

// Minimal Twilio REST client (HTTP Basic auth, form-encoded posts).
function twilio() {
  const sid = env('TWILIO_ACCOUNT_SID');
  const token = env('TWILIO_AUTH_TOKEN');
  const base = `https://api.twilio.com/2010-04-01/Accounts/${sid}`;
  const auth = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');

  async function post(path, form) {
    const r = await fetch(base + path, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form).toString(),
    });
    const text = await r.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (_) { /* non-JSON error page */ }
    if (!r.ok) {
      const detail = (parsed && (parsed.message || parsed.detail)) || text.slice(0, 300);
      throw new Error(`Twilio ${path} -> ${r.status} ${detail}`);
    }
    return parsed;
  }

  return { post };
}

// US phone helpers: compare on the last 10 digits so +1/formatting never matters.
function digits(phone) {
  return String(phone || '').replace(/\D/g, '');
}
function last10(phone) {
  const d = digits(phone);
  return d.slice(-10);
}

function escXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Public base URL of this deployment, used to build absolute webhook URLs.
function baseUrl() {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return 'https://' + process.env.VERCEL_URL;
  return '';
}

function twiml(res, xml) {
  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(xml);
}

function json(res, code, obj) {
  res.status(code).json(obj);
}

module.exports = { env, readBody, sb, twilio, digits, last10, escXml, baseUrl, twiml, json };
