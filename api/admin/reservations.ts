import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from '../_auth';
import { proxyToRailway } from '../_proxy';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return proxyToRailway(req, res, '/api/admin/reservations');

  if (!verifyAdminToken(req.headers.authorization as string)) {
    return res.status(401).json({ success: false, error: 'Invalid or expired admin session' });
  }

  const { start, end, month, year } = req.query as Record<string, string>;
  let query = supabase
    .from('reservations')
    .select('*, boats(id, name, owner_type, partners(name)), customers(full_name, phone, tags, rating_stars, rating_notes)')
    .order('start_date', { ascending: false });

  if (month && year) {
    query = query.like('start_date', `${year}-${month.padStart(2, '0')}%`);
  } else {
    if (start) query = query.gte('start_date', start);
    if (end) query = query.lte('start_date', end);
  }

  const { data, error } = await query;
  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true, data });
}
