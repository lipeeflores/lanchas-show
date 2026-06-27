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
  if (req.method !== 'GET') return proxyToRailway(req, res, '/api/admin/accounts-payable');

  if (!verifyAdminToken(req.headers.authorization as string)) {
    return res.status(401).json({ success: false, error: 'Invalid or expired admin session' });
  }

  const { status } = req.query as Record<string, string>;
  let query = supabase.from('accounts_payable').select('*, partners(name)').order('due_date');
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true, data });
}
