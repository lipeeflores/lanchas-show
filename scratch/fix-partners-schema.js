import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://niqexrfhzncptudyiupq.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pcWV4cmZoem5jcHR1ZHlpdXBxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgwMTcwNCwiZXhwIjoyMDkxMzc3NzA0fQ.w2V_zTmoPBsG_ReWdEjjZNgdqjD5OVqBo2W0MXjJdxo';

// Use Supabase REST API to execute SQL via the pg endpoint
const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: `ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS phone TEXT, ADD COLUMN IF NOT EXISTS management_level TEXT DEFAULT 'L1';`
  })
});

if (!response.ok) {
  // Fallback: use direct postgres connection via supabase-js
  console.log('RPC failed, trying direct approach...');
  
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  
  // Try inserting a test row to see the schema
  const { data: existing } = await supabase.from('partners').select('*').limit(1);
  console.log('Existing partner row:', JSON.stringify(existing));
  
  // Try updating with phone field
  if (existing && existing.length > 0) {
    const { error } = await supabase.from('partners').update({ phone: 'TEST' }).eq('id', existing[0].id);
    if (error) {
      console.log('phone column error:', error.message);
    } else {
      console.log('phone column already exists or was added!');
      // Revert test
      await supabase.from('partners').update({ phone: null }).eq('id', existing[0].id);
    }
  }
} else {
  const result = await response.json();
  console.log('SQL executed successfully:', result);
}
