import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from '../_auth';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyAdminToken(req.headers.authorization as string)) {
    return res.status(401).json({ success: false, error: 'Invalid or expired admin session' });
  }

  const { since } = req.query as Record<string, string>;
  let query = supabase
    .from('ia_conversations')
    .select('*')
    .order('last_message_at', { ascending: false });

  if (since) query = query.gte('created_at', since);

  const { data, error } = await query;
  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true, data });
}
