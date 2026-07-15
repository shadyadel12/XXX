import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  // Fail loud in dev so a missing .env.local is obvious rather than a cryptic 401.
  console.error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
  );
}

/**
 * Single shared Supabase client. Uses the publishable (browser-safe) key.
 * The secret key must NEVER appear in this file or any VITE_ var — it lives
 * only in the `admin` edge function's server env.
 */
export const supabase = createClient<Database>(url ?? '', key ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
