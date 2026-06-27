import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { isValidAdmin, proxyWrite } from './_shared';

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
