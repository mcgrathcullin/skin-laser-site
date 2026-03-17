const { parseBody, hashPassword, verifyAuth, createAuthCookie, corsHeaders } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  try {
    if (req.method === 'POST') {
      return await handleLogin(req, res);
    }

    if (req.method === 'DELETE') {
      return handleLogout(req, res);
    }

    if (req.method === 'GET') {
      return handleCheck(req, res);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Auth API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function handleLogin(req, res) {
  const body = await parseBody(req);
  const { password } = body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = hashPassword(password);
  const cookie = createAuthCookie(token, 60 * 60 * 24 * 7); // 7 days

  res.setHeader('Set-Cookie', cookie);
  res.status(200).json({ success: true, message: 'Logged in' });
}

function handleLogout(req, res) {
  const cookie = createAuthCookie('', 0);
  res.setHeader('Set-Cookie', cookie);
  res.status(200).json({ success: true, message: 'Logged out' });
}

function handleCheck(req, res) {
  const authError = verifyAuth(req);
  if (authError) {
    return res.status(401).json({ authenticated: false });
  }
  res.status(200).json({ authenticated: true });
}
