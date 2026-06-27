import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from '../_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyAdminToken(req.headers.authorization as string)) {
    return res.status(401).json({ success: false, error: 'Invalid or expired admin session' });
  }

  const { conversation_id, since } = req.query as Record<string, string>;
  if (!conversation_id && !since) {
    return res.status(400).json({ success: false, error: 'conversation_id ou since é obrigatório' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  let query = supabase.from('ia_messages').select('*').order('created_at');
  if (conversation_id) query = query.eq('conversation_id', conversation_id);
  if (since) query = query.gte('created_at', since);

  const { data, error } = await query;
  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true, data });
}
