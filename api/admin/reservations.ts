import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function isValidAdmin(authHeader: string | undefined): boolean {
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

const RAILWAY = 'https://lanchas-show-production.up.railway.app';
async function proxyWrite(method: string | undefined, url: string | undefined, body: unknown, authHeader: string, path: string): Promise<Response> {
  const qs = url?.includes('?') ? url.substring(url.indexOf('?')) : '';
  return fetch(`${RAILWAY}${path}${qs}`, {
    method: method || 'GET',
    headers: { 'content-type': 'application/json', authorization: authHeader },
    body: method !== 'GET' ? JSON.stringify(body) : undefined,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    const r = await proxyWrite(req.method, req.url, req.body, req.headers.authorization as string || '', '/api/admin/reservations');
    const text = await r.text();
    res.status(r.status);
    try { return res.json(JSON.parse(text)); } catch { return res.send(text); }
  }
  if (!isValidAdmin(req.headers.authorization as string)) {
    return res.status(401).json({ success: false, error: 'Invalid or expired admin session' });
  }
  const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { start, end, month, year } = req.query as Record<string, string>;
  let q = supabase.from('reservations')
    .select('*, boats(id, name, owner_type, partners(name)), customers(full_name, phone, tags, rating_stars, rating_notes)')
    .order('start_date', { ascending: false });
  if (month && year) q = q.like('start_date', `${year}-${month.padStart(2, '0')}%`);
  else { if (start) q = q.gte('start_date', start); if (end) q = q.lte('start_date', end); }
  const { data, error } = await q;
  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true, data });
}
