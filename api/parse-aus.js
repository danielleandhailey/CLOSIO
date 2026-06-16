export const config = {
  api: { bodyParser: { sizeLimit: '50mb' }, responseLimit: false },
};

// Forced tool so output is always valid JSON.
const AUS_TOOL = {
  name: 'extract_aus_findings',
  description: 'Extract the key fields from an AUS (DU/Desktop Underwriter or LPA/Loan Product Advisor) underwriting findings report.',
  input_schema: {
    type: 'object',
    properties: {
      aus_type: { type: 'string', description: 'DU or LPA' },
      recommendation: { type: 'string', description: 'e.g. Approve/Eligible, Approve/Ineligible, Refer/Eligible, Refer with Caution, Accept' },
      eligible: { type: 'boolean', description: 'true if Eligible/Approve-Eligible/Accept; false if Ineligible or Refer.' },
      ineligible_reasons: { type: 'array', items: { type: 'string' }, description: 'If ineligible or refer, the specific reason(s) why (e.g. "inadequate funds to close").' },
      primary_borrower: { type: 'string' },
      co_borrower: { type: 'string' },
      loan_number: { type: 'string' },
      casefile_id: { type: 'string' },
      submission_date: { type: 'string' },
      loan_type: { type: 'string', description: 'Conventional, FHA, VA, USDA, etc.' },
      loan_purpose: { type: 'string' },
      loan_term: { type: 'string' },
      amortization_type: { type: 'string' },
      loan_amount: { type: 'number' },
      total_loan_amount: { type: 'number' },
      sales_price: { type: 'number' },
      appraised_value: { type: 'number' },
      note_rate: { type: 'number' },
      ltv: { type: 'number' },
      cltv: { type: 'number' },
      housing_ratio: { type: 'number', description: 'Housing / front-end DTI percent' },
      total_ratio: { type: 'number', description: 'Total / back-end DTI percent' },
      appraisal_waiver: { type: 'string', description: 'Appraisal waiver / PIW / value acceptance status, e.g. N/A, Eligible, Yes, No.' },
      tax_returns_required: { type: 'string' },
      funds_required: { type: 'number' },
      funds_available: { type: 'number' },
      funds_shortage: { type: 'number', description: 'Positive number if there is a shortage of funds to close.' },
      reserves: { type: 'number' },
      months_reserves: { type: 'number' },
      disbursement_by_date: { type: 'string', description: 'Date the loan must disburse by / verification docs expire.' },
      credit_scores: { type: 'array', items: { type: 'object', properties: {
        borrower: { type: 'string' }, scores: { type: 'array', items: { type: 'number' } },
      } } },
      income_used: { type: 'array', items: { type: 'object', properties: {
        borrower: { type: 'string' }, type: { type: 'string' }, amount: { type: 'number' },
      } } },
      assets_used: { type: 'array', items: { type: 'object', properties: {
        borrower: { type: 'string' }, account_type: { type: 'string' }, institution: { type: 'string' }, amount: { type: 'number' },
      } } },
      omitted_liabilities: { type: 'array', items: { type: 'object', properties: {
        borrower: { type: 'string' }, creditor: { type: 'string' }, payment: { type: 'number' }, balance: { type: 'number' },
      } }, description: 'Accounts omitted from the underwriting analysis (lender must document the omission).' },
      conditions: { type: 'array', items: { type: 'string' }, description: 'The verification messages / approval conditions list.' },
      summary: { type: 'string', description: '2-3 sentence plain-English summary of the result and what is needed.' },
    },
    required: ['recommendation'],
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!CLAUDE_API_KEY) return res.status(500).json({ error: 'Claude API key not configured.' });

  const { text, base64Data, mimeType } = req.body || {};
  if (!text && !base64Data) return res.status(400).json({ error: 'No AUS text or file received.' });

  const instruction =
    'This is an AUS underwriting findings report (Fannie Mae DU or Freddie LPA). Read it and call ' +
    'extract_aus_findings with every field you can find. Capture the recommendation exactly, and if it ' +
    'is Ineligible or Refer, list the specific reasons. Capture ratios, LTV, funds (required/available/' +
    'shortage/reserves), appraisal waiver / PIW status, credit scores per borrower, the income and assets ' +
    'used, any omitted liabilities, and the verification messages/conditions. Only include fields actually present.';

  const content = base64Data
    ? [
        (mimeType || '').startsWith('image/')
          ? { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } }
          : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
        { type: 'text', text: instruction },
      ]
    : `${instruction}\n\n--- AUS FINDINGS TEXT ---\n${text}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        tools: [AUS_TOOL],
        tool_choice: { type: 'tool', name: 'extract_aus_findings' },
        messages: [{ role: 'user', content }],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(200).json({ error: data.error.message || 'AI error' });

    const toolUse = (data.content || []).find((b) => b.type === 'tool_use');
    return res.status(200).json(toolUse?.input || { error: 'No findings parsed.' });
  } catch (e) {
    return res.status(200).json({ error: e.message });
  }
}
