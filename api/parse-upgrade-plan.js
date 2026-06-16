export const config = {
  api: { bodyParser: { sizeLimit: '4mb' }, responseLimit: false },
};

// Forced tool so output is always valid JSON.
const PLAN_TOOL = {
  name: 'extract_credit_plan',
  description:
    'Extract a credit-improvement game plan from the pasted email/text. ' +
    'Break it into clear, simple action steps a loan officer can check off.',
  input_schema: {
    type: 'object',
    properties: {
      target_score: { type: 'string', description: 'The goal/target credit score if stated (e.g. "620"). Omit if not mentioned.' },
      lender_name: { type: 'string', description: 'The name of the person who sent the email / the credit-repair or lender contact to reply to. Omit if not found.' },
      lender_email: { type: 'string', description: 'The reply-to / sender email address for that contact. Omit if not found.' },
      steps: {
        type: 'array',
        description: 'Each distinct action item in the plan, in order.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Short, plain-English action (e.g. "Dispute & remove collection — Merrick Bank").' },
            cost: { type: 'string', description: 'Dollar cost of this step if stated (e.g. "150"). Omit if none.' },
            impact: { type: 'string', description: 'Expected point increase if stated (e.g. "+20"). Omit if none.' },
          },
          required: ['text'],
        },
      },
    },
    required: ['steps'],
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!CLAUDE_API_KEY) return res.status(500).json({ error: 'Claude API key not configured.', steps: [] });

  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'No text received.', steps: [] });

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
        max_tokens: 1500,
        tools: [PLAN_TOOL],
        tool_choice: { type: 'tool', name: 'extract_credit_plan' },
        messages: [
          {
            role: 'user',
            content:
              'The following is an email/message from a credit-repair company describing a plan to raise a ' +
              'borrower\'s credit score. Read it and call extract_credit_plan. Summarize each action into one ' +
              'short, clear step. Capture any dollar cost or expected point gain per step, and the target score ' +
              'if mentioned. Keep it simple — a loan officer should be able to check each step off.\n\n' +
              '--- PASTED TEXT ---\n' + text,
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(200).json({ error: data.error.message || 'AI error', steps: [] });

    const toolUse = (data.content || []).find((b) => b.type === 'tool_use');
    const input = toolUse?.input || {};
    return res.status(200).json({
      target_score: input.target_score || '',
      lender_name: input.lender_name || '',
      lender_email: input.lender_email || '',
      steps: input.steps || [],
    });
  } catch (e) {
    return res.status(200).json({ error: e.message, steps: [] });
  }
}
