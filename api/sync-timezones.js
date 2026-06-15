import { createClient } from '@supabase/supabase-js';
import { getBonzoToken } from '../lib/bonzoToken';

const BONZO_API_URL = 'https://app.getbonzo.com/api/v3';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const BONZO_TOKEN = await getBonzoToken();
  if (!BONZO_TOKEN || !supabase) {
    return res.status(500).json({ error: 'Missing config' });
  }

  try {
    // Get all CLOSIO borrowers with bonzo_id
    const { data: borrowers } = await supabase
      .from('borrowers')
      .select('id, bonzo_id, name')
      .not('bonzo_id', 'is', null);

    let updated = 0;

    for (const b of borrowers) {
      // Fetch this prospect from Bonzo
      const response = await fetch(`${BONZO_API_URL}/prospects/${b.bonzo_id}`, {
        headers: {
          'Authorization': `Bearer ${BONZO_TOKEN}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const prospect = data.data || data;

        if (prospect.timezone) {
          await supabase
            .from('borrowers')
            .update({ timezone: prospect.timezone })
            .eq('id', b.id);
          updated++;
          console.log('Updated timezone for:', b.name, prospect.timezone);
        }
      }
    }

    return res.status(200).json({ success: true, updated, total: borrowers.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
