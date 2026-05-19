const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verify() {
  console.log('Verifying n8n catalog view...');

  const { data, error } = await supabase.from('vw_boats_catalog_n8n').select('*').limit(3);

  if (error) {
    console.error('Error selecting from view:', error.message);
    process.exit(1);
  }
  
  console.log('View is working! Sample Data:');
  console.log(JSON.stringify(data, null, 2));

  console.log('\nVerifying new reservations columns...');
  const { data: resData, error: resError } = await supabase.from('reservations').select('id, passenger_count, negotiation_status, last_interaction_at').limit(1);
  
  if (resError) {
    console.error('Error selecting from reservations:', resError.message);
    process.exit(1);
  }

  console.log('Reservations table updated! Sample Data:');
  console.log(JSON.stringify(resData, null, 2));
}

verify().catch(console.error);
