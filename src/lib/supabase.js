import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://pevypaozaaccncuktlbp.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBldnlwYW96YWFjY25jdWt0bGJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNDM2NjEsImV4cCI6MjA5NTkxOTY2MX0.QxEVW7XGQmh_AfdOMSVFhIdqOn_boCp1ZTt9xKM9-ak';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export default supabase;
