import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { isValidAdmin } from './_shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isValidAdmin(req.headers.authorization as string)) {
    return res.status(401).json({ success: false, error: 'Invalid or expired admin session' });
  }
  const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('system_alerts')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true, data });
}
