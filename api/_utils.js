const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const COOKIE_NAME = 'slm_auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Make a request to Supabase REST API.
 * Returns { data, error }.
 */
async function supabase(path, options = {}) {
  const { method = 'GET', body, headers = {} } = options;

  const url = `${SUPABASE_URL}/rest/v1/${path}`;

  const fetchOptions = {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : 'return=representation',
      ...headers,
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, fetchOptions);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!response.ok) {
      return { data: null, error: data };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * Send an email via Resend API.
 */
async function sendEmail({ from, to, subject, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return response.json();
}

/**
 * Parse the request body as JSON.
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    // If body is already parsed (Vercel does this)
    if (req.body) {
      return resolve(req.body);
    }

    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

/**
 * Hash a password using SHA-256.
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Verify the auth cookie. Returns null if valid, error string if invalid.
 */
function verifyAuth(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];

  if (!token) {
    return 'Authentication required';
  }

  const expectedHash = hashPassword(ADMIN_PASSWORD);
  if (token !== expectedHash) {
    return 'Invalid authentication';
  }

  return null;
}

/**
 * Parse cookie header string into an object.
 */
function parseCookies(cookieStr) {
  const cookies = {};
  if (!cookieStr) return cookies;

  cookieStr.split(';').forEach(pair => {
    const [name, ...rest] = pair.trim().split('=');
    if (name) {
      cookies[name.trim()] = decodeURIComponent(rest.join('=').trim());
    }
  });

  return cookies;
}

/**
 * Create the Set-Cookie header value for the auth cookie.
 */
function createAuthCookie(value, maxAge) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (maxAge !== undefined) {
    parts.push(`Max-Age=${maxAge}`);
  }

  // Only set Secure in production
  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

module.exports = {
  supabase,
  sendEmail,
  parseBody,
  hashPassword,
  verifyAuth,
  parseCookies,
  createAuthCookie,
  corsHeaders,
  COOKIE_NAME,
};
