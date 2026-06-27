import crypto from 'crypto';

const SECRET = process.env.ADMIN_SESSION_SECRET || 'lanchas-show-dev-secret-change-me';

export function verifyAdminToken(authHeader: string | undefined): boolean {
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
    const expected = crypto.createHmac('sha256', SECRET).update(`${username}.${exp}`).digest('hex');
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
