import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Read the Bonzo API token from the in-app settings table (set on the CLOSIO
// Settings page). Falls back to the BONZO_API_TOKEN env var if not set there.
export async function getBonzoToken() {
  try {
    if (supabase) {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'bonzo_api_token')
        .single();
      if (data && data.value) return data.value;
    }
  } catch (e) {
    /* table may not exist yet — fall back to env */
  }
  return process.env.BONZO_API_TOKEN || null;
}
