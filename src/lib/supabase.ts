import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = 'Missing Supabase environment variables (VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY). Please check your .env file or Netlify environment settings.';
  console.error(errorMsg);
  // We throw a descriptive error to help the user identify the issue in the console.
  throw new Error(errorMsg);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
