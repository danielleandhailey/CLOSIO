import { getBonzoToken } from '../lib/bonzoToken';

const BONZO_API_URL = 'https://app.getbonzo.com/api/v3';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const BONZO_TOKEN = await getBonzoToken();
  if (!BONZO_TOKEN) {
    return res.status(500).json({ error: 'Bonzo API token not configured — add it on the CLOSIO Settings page.' });
  }

  // GET - Pull notes from Bonzo
  if (req.method === 'GET') {
    const { prospectId } = req.query;

    if (!prospectId) {
      return res.status(400).json({ error: 'Missing prospectId' });
    }

    try {
      const response = await fetch(`${BONZO_API_URL}/prospects/${prospectId}/notes`, {
        headers: {
          'Authorization': `Bearer ${BONZO_TOKEN}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Bonzo notes error:', response.status, errText);
        return res.status(response.status).json({ error: `Bonzo API error: ${response.status}` });
      }

      const data = await response.json();
      const notesData = data.data || data || [];

      const notes = notesData.map(n => ({
        body: n.body || n.note || n.content || '',
        date: n.created_at ? new Date(n.created_at).toLocaleString() : '',
        author: n.user?.name || n.author || '',
      })).sort((a, b) => new Date(b.date) - new Date(a.date));

      return res.status(200).json({ success: true, notes });

    } catch (e) {
      console.error('Bonzo notes error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  // POST - Push note to Bonzo
  if (req.method === 'POST') {
    const { prospectId, note } = req.body;

    if (!prospectId || !note) {
      return res.status(400).json({ error: 'Missing prospectId or note' });
    }

    try {
      const response = await fetch(`${BONZO_API_URL}/prospects/${prospectId}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BONZO_TOKEN}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: note }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Bonzo push note error:', response.status, errText);
        return res.status(response.status).json({ error: `Bonzo API error: ${response.status}` });
      }

      return res.status(200).json({ success: true });

    } catch (e) {
      console.error('Bonzo push note error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
