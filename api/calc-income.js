export const config = { api: { bodyParser: { sizeLimit: '2mb' }, responseLimit: false } };

// Forced tool so the result is always valid JSON.
const CALC_TOOL = {
  name: 'calc_qualifying_income',
  description: 'Calculate a W-2 borrower\'s monthly qualifying income like a mortgage underwriter.',
  input_schema: {
    type: 'object',
    properties: {
      ytd_method_monthly: { type: 'number', description: 'YTD gross ÷ number of months elapsed to the pay period END date.' },
      current_method_monthly: { type: 'number', description: 'Current period gross × pay periods per year ÷ 12.' },
      w2_avg_monthly: { type: 'number', description: 'If 2 years of W-2s are given, their average ÷ 12. Omit if no W-2s.' },
      qualifying_monthly: { type: 'number', description: 'The figure an underwriter would actually use — the most conservative (lowest) supportable number, unless clearly stable/increasing with documentation.' },
      method_used: { type: 'string', description: 'Which method qualifying_monthly came from, e.g. "YTD average".' },
      months_used: { type: 'number', description: 'Months elapsed you divided YTD by.' },
      notes: { type: 'array', items: { type: 'string' }, description: 'Short underwriter notes (e.g. verify employment dates, OT/bonus consistency, holiday pay included).' },
      flags: { type: 'array', items: { type: 'string' }, description: 'Red flags / things to confirm (e.g. declining vs W-2, base pay change, part-time vs full-time, employer name mismatch).' },
    },
    required: ['qualifying_monthly', 'method_used'],
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'AI key not configured.' });

  const job = req.body || {};
  const w2Lines = (job.w2s || []).map(w => `  - ${w.year}: $${w.wages}`).join('\n');

  const prompt =
    'You are a mortgage underwriter calculating MONTHLY qualifying income for a W-2 borrower. ' +
    'Rules: (1) Current = YTD gross ÷ number of months elapsed to the pay period END date. ' +
    '(2) Current rate = current-period gross × pay periods/year ÷ 12. ' +
    '(3) If 2 years of W-2s are given, average them ÷ 12. ' +
    '(4) Compare: if the YTD pace is LOWER than the W-2 average (declining), use the lower number. ' +
    'If stable/matching, the current rate is supportable. Overtime/bonus only count with a 2-year ' +
    'history and must be averaged, not taken at current pace. ' +
    'Return the most CONSERVATIVE supportable qualifying_monthly and call calc_qualifying_income.\n\n' +
    `Borrower: ${job.person || ''}\nEmployer: ${job.employer || ''}\nIncome type: ${job.income_type || 'base'}\n` +
    `Pay frequency: ${job.pay_frequency || ''}\nCurrent period gross: $${job.current_gross || '?'}\n` +
    `YTD gross: $${job.ytd_gross || '?'}\nPay period END date: ${job.period_end_date || '?'}\n` +
    (w2Lines ? `Prior W-2s:\n${w2Lines}\n` : 'Prior W-2s: none provided\n');

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        tools: [CALC_TOOL],
        tool_choice: { type: 'tool', name: 'calc_qualifying_income' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await r.json();
    if (data.error) return res.status(200).json({ error: data.error.message || 'AI error' });
    const toolUse = (data.content || []).find(b => b.type === 'tool_use');
    return res.status(200).json(toolUse?.input || { error: 'No calc returned.' });
  } catch (e) {
    return res.status(200).json({ error: e.message });
  }
}
