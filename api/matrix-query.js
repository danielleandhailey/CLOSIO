export default async function handler(req, res) {
  // Read env vars inside handler (required for Vercel)
  const ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;

  // Debug: log what we find
  console.log('CLAUDE_API_KEY exists:', !!process.env.CLAUDE_API_KEY);
  console.log('ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);

  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.length === 0) {
    return res.status(500).json({ error: 'Server misconfiguration: CLAUDE_API_KEY is missing or empty.' });
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { question, context } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Missing question' });
  }

  try {
    const systemPrompt = context && context.trim()
      ? `You are a mortgage lender guideline expert. Answer questions based ONLY on the following indexed lender guidelines:

${context}

IMPORTANT:
- Only answer based on the information provided above
- If the answer is not found in the guidelines above, say "I couldn't find this information in your uploaded lender guidelines. Would you like me to search general knowledge?"
- Be specific and cite which lender the information comes from
- Give clear, actionable answers
- Use bullet points for lists
- Put each lender on its own line
- Keep it short and scannable`
      : `You are a mortgage lending expert. The user has not uploaded any lender guidelines yet. Let them know they should upload PDF guidelines to get specific answers, but you can provide general mortgage knowledge if they'd like.`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }]
      })
    });

    const data = await claudeResponse.json();
    const answer = data.content?.[0]?.text || 'No response.';

    return res.status(200).json({ success: true, answer });

  } catch (e) {
    console.error('Matrix query error:', e);
    return res.status(500).json({ error: e.message });
  }
}
