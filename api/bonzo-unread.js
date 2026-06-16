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
    // Bonzo conversation shape: id (prospect), unread_messages_count, new_response,
    // last_incoming_message, last_contact, phone, email, full_name.
    const li = c.last_incoming_message;
    const liAt = (li && typeof li === 'object')
      ? (li.created_at || li.sent_at || li.date || li.timestamp || li.time || null)
      : null;
    const lastAt = liAt || c.last_contact || c.updated_at || null;
    const unread = Number(c.unread_messages_count || 0) > 0 || c.new_response === true;
    return {
      prospectId: c.id != null ? String(c.id) : null,
      lastAt,
      unread,
      phone: (c.phone || '').replace(/\D/g, '').slice(-10),
      email: (c.email || '').toLowerCase().trim(),
      name: c.full_name || '',
    };
  }).filter(x => x.prospectId);

  return res.status(200).json({ items, used, sampleKeys: items.length ? undefined : Object.keys(raw[0] || {}) });
}
