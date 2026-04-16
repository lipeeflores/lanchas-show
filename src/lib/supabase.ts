import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Database features will not work.');
}

// Fallback to empty strings to prevent createClient from crashing if variables are missing
export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || ''
);
