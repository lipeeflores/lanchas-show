import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'lanchas-show-dev-secret-change-me';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
  console.warn('[Auth] AVISO: ADMIN_USERNAME ou ADMIN_PASSWORD não definidos no .env. Login admin desabilitado.');
}
if (SESSION_SECRET === 'lanchas-show-dev-secret-change-me') {
  console.warn('[Auth] AVISO: ADMIN_SESSION_SECRET não definido. Use um segredo forte em produção.');
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function signSession(username: string): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${username}.${exp}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`, 'utf-8').toString('base64url');
}

export function verifySession(token: string): { username: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split('.');
    if (parts.length !== 3) return null;
    const [username, expStr, sig] = parts;
    const exp = Number(expStr);
    if (!username || !exp || !sig) return null;
    if (Date.now() > exp) return null;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(`${username}.${exp}`).digest('hex');
    if (!timingSafeEqualStr(sig, expected)) return null;
    return { username };
  } catch {
    return null;
  }
}

export function validateAdminCredentials(username: string, password: string): boolean {
  if (typeof username !== 'string' || typeof password !== 'string') return false;
  const userOk = username.length === ADMIN_USERNAME.length && timingSafeEqualStr(username, ADMIN_USERNAME);
  const passOk = password.length === ADMIN_PASSWORD.length && timingSafeEqualStr(password, ADMIN_PASSWORD);
  return userOk && passOk;
}

/**
 * Express middleware that requires a valid admin session token in the Authorization header
 * (Bearer <token>) or in a custom 'x-admin-token' header.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof req.headers['x-admin-token'] === 'string') {
    token = req.headers['x-admin-token'] as string;
  }

  if (!token) {
    res.status(401).json({ success: false, error: 'Missing admin session token' });
    return;
  }

  const session = verifySession(token);
  if (!session) {
    res.status(401).json({ success: false, error: 'Invalid or expired admin session' });
    return;
  }

  (req as any).adminSession = session;
  next();
}
