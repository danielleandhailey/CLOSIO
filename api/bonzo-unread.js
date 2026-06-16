import { getBonzoToken } from '../lib/bonzoToken';

const BONZO_API_URL = 'https://app.getbonzo.com/api/v3';

// Returns, for each conversation, the prospect id + whether it has an unread
// (new inbound) text and the time of the last message. The frontend compares
// lastAt against a locally-stored "seen" time to light up the pink dot.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = await getBonzoToken();
  if (!token) return res.status(200).json({ items: [], error: 'No Bonzo token' });

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const endpoints = [
    `${BONZO_API_URL}/conversations?per_page=100&sort=-updated_at`,
    `${BONZO_API_URL}/conversations?per_page=100`,
    `${BONZO_API_URL}/messages?per_page=100&sort=-created_at`,
  ];

  let raw = null, used = null;
  for (const url of endpoints) {
    try {
      const r = await fetch(url, { headers });
      if (r.ok) { const d = await r.json(); raw = d.data || d.conversations || d.messages || d || []; used = url; break; }
    } catch (e) { /* try next */ }
  }
  if (!Array.isArray(raw)) return res.status(200).json({ items: [], note: 'No conversations endpoint matched', used });

  const items = raw.map(c => {
    const prospectId = c.prospect_id ?? c.prospect?.id ?? c.lead_id ?? c.person_id ?? c.contact_id ?? c.prospectId ?? null;
    const last = c.last_message ?? c.latest_message ?? c.message ?? c ?? {};
    const dir = String(last.direction || (last.from_user || last.outbound ? 'outbound' : 'inbound') || '').toLowerCase();
    const lastAt = c.last_message_at || c.last_activity_at || last.created_at || c.updated_at || c.created_at || null;
    const uc = c.unread_count ?? c.unread ?? null;
    const unread = uc != null ? (uc === true || Number(uc) > 0) : (dir === 'inbound');
    return { prospectId: prospectId != null ? String(prospectId) : null, lastAt, direction: dir, unread };
  }).filter(x => x.prospectId);

  return res.status(200).json({ items, used, sampleKeys: items.length ? undefined : Object.keys(raw[0] || {}) });
}
