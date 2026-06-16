export const config = {
  api: { bodyParser: { sizeLimit: '50mb' }, responseLimit: false },
};

const VERIFY_TOOL = {
  name: 'verify_proof',
  description: 'Decide whether the attached document is valid proof that the given credit-repair step was completed.',
  input_schema: {
    type: 'object',
    properties: {
      verified: { type: 'boolean', description: 'True only if the document reasonably proves the step was done (e.g. a paid receipt, zero-balance letter, deletion/dispute removal letter for the right creditor).' },
      note: { type: 'string', description: 'One short sentence explaining the decision (what the document shows).' },
    },
    required: ['verified', 'note'],
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!CLAUDE_API_KEY) return res.status(500).json({ verified: false, note: 'AI key not configured.' });

  const { base64Data, mimeType, stepText } = req.body || {};
  if (!base64Data) return res.status(400).json({ verified: false, note: 'No document received.' });

  const isImage = (mimeType || '').startsWith('image/');
  const mediaBlock = isImage
    ? { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } }
    : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        tools: [VERIFY_TOOL],
        tool_choice: { type: 'tool', name: 'verify_proof' },
        messages: [
          {
            role: 'user',
            content: [
              mediaBlock,
              {
                type: 'text',
                text:
                  `The credit-repair step is: "${stepText || ''}". Look at the attached document and call ` +
                  'verify_proof. Mark verified=true only if the document is reasonable proof this specific step ' +
                  'was completed (e.g. a receipt/zero-balance statement for the right creditor, a deletion or ' +
                  'dispute-removal letter, a paid-in-full or settlement letter). If the document is unrelated, ' +
                  'illegible, or for a different account, mark verified=false and say why.',
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(200).json({ verified: false, note: data.error.message || 'AI error' });

    const toolUse = (data.content || []).find((b) => b.type === 'tool_use');
    const input = toolUse?.input || {};
    return res.status(200).json({ verified: !!input.verified, note: input.note || '' });
  } catch (e) {
    return res.status(200).json({ verified: false, note: e.message });
  }
}
