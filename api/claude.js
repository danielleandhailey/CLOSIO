export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const CLAUDE_API_KEY = process.env.REACT_APP_CLAUDE_API_KEY;
  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'Claude API key not configured' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        ...(req.body.isPDF ? { 'anthropic-beta': 'pdfs-2024-09-25' } : {}),
      },
      body: JSON.stringify({
        model: req.body.model || 'claude-3-5-sonnet-20241022',
        max_tokens: req.body.max_tokens || 1500,
        system: req.body.system,
        messages: req.body.messages,
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (e) {
    console.error('Claude API error:', e);
    return res.status(500).json({ error: e.message });
  }
}
