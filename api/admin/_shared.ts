import crypto from 'crypto';

const RAILWAY = 'https://lanchas-show-production.up.railway.app';

export function isValidAdmin(authHeader: string | undefined): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split('.');
    if (parts.length !== 3) return false;
    const [username, expStr, sig] = parts;
    const exp = Number(expStr);
    if (!username || !exp || !sig) return false;
    if (Date.now() > exp) return false;
    const secret = process.env.ADMIN_SESSION_SECRET || 'lanchas-show-dev-secret-change-me';
    const expected = crypto.createHmac('sha256', secret).update(`${username}.${exp}`).digest('hex');
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch { return false; }
}

export async function proxyWrite(method: string | undefined, url: string | undefined, body: unknown, authHeader: string, path: string): Promise<Response> {
  const qs = url?.includes('?') ? url.substring(url.indexOf('?')) : '';
  return fetch(`${RAILWAY}${path}${qs}`, {
    method: method || 'GET',
    headers: { 'content-type': 'application/json', authorization: authHeader },
    body: method !== 'GET' ? JSON.stringify(body) : undefined,
  });
}
