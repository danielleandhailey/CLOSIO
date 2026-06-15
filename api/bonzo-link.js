import { createClient } from '@supabase/supabase-js';
import { getBonzoToken } from '../lib/bonzoToken';

const BONZO_API_URL = 'https://app.getbonzo.com/api/v3';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const digits = (s) => (s || '').replace(/\D/g, '').slice(-10);

// Find a Bonzo prospect for an existing borrower (by phone/email/name) and link it.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { borrowerId, phone, email, name } = req.query;

  const BONZO_TOKEN = await getBonzoToken();
  if (!BONZO_TOKEN) {
    return res.status(500).json({ error: 'Bonzo API token not configured — add it on the CLOSIO Settings page.' });
  }

  const headers = { Authorization: `Bearer ${BONZO_TOKEN}`, Accept: 'application/json' };
  const targetPhone = digits(phone);
  const targetEmail = (email || '').toLowerCase().trim();

  const terms = [];
  if (phone) terms.push(phone);
  if (targetEmail) terms.push(targetEmail);
  if (name) terms.push(name);

  try {
    let match = null;
    for (const term of terms) {
      const r = await fetch(`${BONZO_API_URL}/prospects?search=${encodeURIComponent(term)}&per_page=25`, { headers });
      if (!r.ok) {
        if (r.status === 401) return res.status(401).json({ error: 'Bonzo token rejected (401) — update it on the Settings page.' });
        continue;
      }
      const d = await r.json();
      const list = d.data || d || [];
      match = list.find(p => {
        const pp = digits(p.phone || p.mobile);
        const pe = (p.email || '').toLowerCase().trim();
        return (targetPhone && pp === targetPhone) || (targetEmail && pe === targetEmail);
      }) || (list.length === 1 ? list[0] : null);
      if (match) break;
    }

    if (!match) {
      return res.status(404).json({ error: 'No matching Bonzo prospect found for this borrower.' });
    }

    if (supabase && borrowerId) {
      await supabase.from('borrowers')
        .update({ bonzo_id: String(match.id), bonzo_last_sync: new Date().toISOString() })
        .eq('id', borrowerId);
    }

    return res.status(200).json({ success: true, prospectId: String(match.id) });
  } catch (e) {
    console.error('Bonzo link error:', e);
    return res.status(500).json({ error: e.message });
  }
}
