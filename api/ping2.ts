import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

function check(authHeader: string | undefined): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    return decoded.split('.').length === 3;
  } catch { return false; }
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const ok = check(req.headers.authorization as string);
  res.json({ ok, method: req.method, hasAuth: !!req.headers.authorization });
}
