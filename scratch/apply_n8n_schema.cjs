const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// The user's scratch directory context showed using connection string directly, or I can use the one from .env if available.
// Earlier I used postgresql://postgres:LanchasShow2026!@db.niqexrfhzncptudyiupq.supabase.co:5432/postgres

async function executeSql() {
  const sql = `
    -- Requisito 1: View do Catálogo para o n8n
    CREATE OR REPLACE VIEW public.vw_boats_catalog_n8n AS
    SELECT 
        id,
        name,
        capacity,
        daily_rate as base_price_brl,
        owner_type,
        status,
        'https://lanchas-show.vercel.app/lancha/' || id AS catalog_link
    FROM public.boats
    WHERE status = 'AVAILABLE';

    -- Permissões para que role o RLS do bot se via Supabase API anon key
    -- Views by default inherit RLS from the underlying table if invoked with security invoker, otherwise definer.
    ALTER VIEW public.vw_boats_catalog_n8n OWNER TO postgres;

    -- Requisito 2: Adicionar colunas do funil na tabela reservations
    ALTER TABLE public.reservations 
    ADD COLUMN IF NOT EXISTS passenger_count INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS boarding_point TEXT,
    ADD COLUMN IF NOT EXISTS destination TEXT,
    ADD COLUMN IF NOT EXISTS negotiation_status TEXT DEFAULT 'PROSPECTING',
    ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
    ADD COLUMN IF NOT EXISTS contract_link_url TEXT;
  `;
  
  const client = new Client({
    connectionString: 'postgresql://postgres:LanchasShow2026!@db.niqexrfhzncptudyiupq.supabase.co:5432/postgres',
    ssl: {
      rejectUnauthorized: false
    }
  });

  console.log('Connecting to Supabase DB directly...');
  await client.connect();
  console.log('Connected. Running SQL updates for n8n...');
  
  try {
    const res = await client.query(sql);
    console.log('SQL Executed successfully.');
  } catch (err) {
    console.error('SQL Execution error:', err);
  } finally {
    await client.end();
  }
}

executeSql().catch(console.error);
