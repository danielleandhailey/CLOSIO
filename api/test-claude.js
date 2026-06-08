export default async function handler(req, res) {
  const ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'No API key' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Say hello' }]
      })
    });

    const data = await response.json();
    return res.status(200).json({
      status: response.status,
      keyPrefix: ANTHROPIC_API_KEY.substring(0, 20),
      keyLength: ANTHROPIC_API_KEY.length,
      response: data
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
