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
  if (req.method !== 'GET') return proxyToRailway(req, res, '/api/admin/boats');

  if (!verifyAdminToken(req.headers.authorization as string)) {
    return res.status(401).json({ success: false, error: 'Invalid or expired admin session' });
  }

  const { data, error } = await supabase
    .from('boats')
    .select('*, partners(name, management_level, bank_account_info, contact_phone), boat_expenses(*)')
    .order('name');

  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true, data });
}
