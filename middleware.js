export const config = {
  matcher: ['/admin/:path*'],
};

export default async function middleware(request) {
  const url = new URL(request.url);

  // Always allow the login page
  if (url.pathname === '/admin/login.html' || url.pathname === '/admin/login') {
    return;
  }

  // Check for auth cookie
  const cookieStr = request.headers.get('cookie') || '';
  const token = getCookie(cookieStr, 'slm_auth');

  if (!token) {
    return Response.redirect(new URL('/admin/login.html', request.url));
  }

  // Verify the token matches the hashed password
  const expectedHash = await sha256(process.env.ADMIN_PASSWORD || '');
  if (token !== expectedHash) {
    return Response.redirect(new URL('/admin/login.html', request.url));
  }

  // Auth valid, continue to the requested page
  return;
}

function getCookie(cookieStr, name) {
  if (!cookieStr) return null;
  const match = cookieStr.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
