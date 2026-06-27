import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { isValidAdmin, proxyWrite } from './_shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    const r = await proxyWrite(req.method, req.url, req.body, req.headers.authorization as string || '', '/api/admin/customers');
    const text = await r.text();
    res.status(r.status);
    try { return res.json(JSON.parse(text)); } catch { return res.send(text); }
  }
  if (!isValidAdmin(req.headers.authorization as string)) {
    return res.status(401).json({ success: false, error: 'Invalid or expired admin session' });
  }
  const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { id, search } = req.query as Record<string, string>;
  if (id) {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
    if (error) return res.status(404).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  }
  let query = supabase.from('customers').select('*, reservations(total_price)').order('created_at', { ascending: false });
  if (search) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,document_cpf.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true, data });
}
