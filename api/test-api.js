export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY || '';
  const keyStart = key.substring(0, 20);
  const keyLength = key.length;

  // Try a simple API call
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say hi' }]
      })
    });
    const data = await response.json();
    return res.status(200).json({
      keyStart,
      keyLength,
      apiResponse: data
    });
  } catch (e) {
    return res.status(200).json({
      keyStart,
      keyLength,
      error: e.message
    });
  }
}
