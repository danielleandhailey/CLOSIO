const BONZO_API_URL = 'https://app.getbonzo.com/api/v3';
const BONZO_TOKEN = process.env.BONZO_API_TOKEN;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prospectId } = req.query;

  if (!prospectId) {
    return res.status(400).json({ error: 'Missing prospectId' });
  }

  if (!BONZO_TOKEN) {
    return res.status(500).json({ error: 'Bonzo API token not configured' });
  }

  try {
    // Fetch conversations for this prospect
    const response = await fetch(`${BONZO_API_URL}/prospects/${prospectId}/conversations`, {
      headers: {
        'Authorization': `Bearer ${BONZO_TOKEN}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Bonzo comms error:', response.status, errText);
      return res.status(response.status).json({ error: `Bonzo API error: ${response.status}` });
    }

    const data = await response.json();
    const conversations = data.data || data || [];

    // Format messages
    const messages = conversations.flatMap(conv => {
      const msgs = conv.messages || [];
      return msgs.map(m => ({
        direction: m.direction || (m.from_user ? 'outbound' : 'inbound'),
        body: m.body || m.message || m.text || '',
        date: m.created_at ? new Date(m.created_at).toLocaleString() : '',
        type: m.type || 'sms',
      }));
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({ success: true, messages });

  } catch (e) {
    console.error('Bonzo comms error:', e);
    return res.status(500).json({ error: e.message });
  }
}
