export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
    responseLimit: false,
  },
};

// Structured field schema. Claude is FORCED to return data through this tool,
// so the response is always valid JSON — no more "not valid JSON" parse failures.
const EXTRACT_TOOL = {
  name: 'extract_mortgage_data',
  description:
    'Extract structured mortgage/loan data from the document or image. ' +
    'Only include fields you actually find — omit anything not present. Do not guess.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: '2-3 sentence summary of the document type and key findings.' },
      document_date: { type: 'string', description: 'The date this document is dated / issued / prepared / effective, in YYYY-MM-DD format. Use the most prominent date on the document (e.g. a Closing Disclosure issue/closing date, an appraisal effective date, a credit report pull date). If truly none, omit.' },

      // Borrowers / parties
      borrower_name: { type: 'string', description: 'Primary borrower, formatted "LASTNAME, First"' },
      co_borrowers: { type: 'array', items: { type: 'string' }, description: 'Co-borrower full names' },
      non_borrowing_spouse: { type: 'string', description: 'Non-borrowing spouse name (for title)' },
      property_address: { type: 'string', description: 'Full subject property address' },
      wholesale_loan_number: { type: 'string', description: 'Lender / wholesale loan number' },

      // Credit report
      credit_auth_date: { type: 'string', description: 'Credit pull / authorization date, YYYY-MM-DD' },
      credit_score_mid: { type: 'number', description: 'Qualifying mid credit score if stated' },
      fico_equifax: { type: 'number', description: 'Equifax FICO score' },
      fico_experian: { type: 'number', description: 'Experian FICO score' },
      fico_transunion: { type: 'number', description: 'TransUnion FICO score' },
      vantage_equifax: { type: 'number', description: 'Equifax VantageScore (only if present on report)' },
      vantage_experian: { type: 'number', description: 'Experian VantageScore (only if present on report)' },
      vantage_transunion: { type: 'number', description: 'TransUnion VantageScore (only if present on report)' },
      negative_marks: { type: 'number', description: 'Count of negative marks / derogatory items' },
      public_records: { type: 'number', description: 'Count of public records' },

      // Loan terms
      purchase_price: { type: 'number', description: 'Sale / purchase price in dollars' },
      loan_amount: { type: 'number', description: 'Total loan / note amount in dollars. On a Closing Disclosure or Loan Estimate this is "Loan Amount" in the Loan Terms box.' },
      loan_type: { type: 'string', description: 'Loan PROGRAM only: Conventional, FHA, VA, USDA, Jumbo, Non-QM, HELOC, or Reverse. NOT the purpose.' },
      loan_purpose: { type: 'string', description: 'Loan purpose: Purchase, Refinance, or Cash-Out Refinance.' },
      rate: { type: 'number', description: 'Interest rate as a percent number, e.g. 6.875. On a CD/LE this is "Interest Rate" in the Loan Terms box.' },
      ltv: { type: 'number' },
      dti: { type: 'number' },
      coe_date: { type: 'string', description: 'Closing date / close of escrow / disbursement date, YYYY-MM-DD. On a Closing Disclosure use the Closing Date.' },
      seller_cc: { type: 'number', description: 'Seller credits / concessions / seller-paid costs in dollars' },
      earnest_money: { type: 'number' },
      occupancy: { type: 'string', description: 'e.g. Primary, Second Home, Investment' },
      income_type: { type: 'string' },
      property_type: { type: 'string' },

      // Appraisal
      appraisal_value: { type: 'number' },
      appraisal_type: { type: 'string', description: 'e.g. Full, Drive-By, Desktop, Waiver' },
      appraisal_subject_to: { type: 'boolean' },
      appraisal_reinspection: { type: 'boolean' },

      // Contacts
      buyer_agent_name: { type: 'string' },
      buyer_agent_phone: { type: 'string' },
      buyer_agent_email: { type: 'string' },
      buyer_agent_company: { type: 'string' },
      listing_agent_name: { type: 'string' },
      listing_agent_phone: { type: 'string' },
      listing_agent_email: { type: 'string' },
      listing_agent_company: { type: 'string' },
      title_company: { type: 'string', description: 'Title / escrow / settlement company name' },
      title_company_phone: { type: 'string' },
      title_company_email: { type: 'string' },
      lender_ae_name: { type: 'string', description: 'Lender Account Executive (AE) name' },
      lender_ae_phone: { type: 'string' },
      lender_ae_email: { type: 'string' },
      lender_ae_company: { type: 'string' },
      underwriter_name: { type: 'string', description: 'Underwriter name' },
      underwriter_phone: { type: 'string' },
      underwriter_email: { type: 'string' },

      // Income / assets
      gross_income: { type: 'number' },
      ytd_income: { type: 'number' },
      assets: { type: 'number' },
      agi: { type: 'number' },

      // Approval
      approval_status: { type: 'string' },
      conditions: { type: 'string' },

      contingencies: {
        type: 'array',
        description: 'Purchase agreement contingencies.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            due_date: { type: 'string', description: 'YYYY-MM-DD' },
            fully_executed: { type: 'boolean' },
          },
        },
      },

      incomes: {
        type: 'array',
        description: 'Income sources from paystubs, W-2s, VOE, or tax returns.',
        items: {
          type: 'object',
          properties: {
            person: { type: 'string' },
            employment_type: { type: 'string' },
            income_type: { type: 'string' },
            employer: { type: 'string' },
            gross_monthly: { type: 'number' },
            pay_frequency: { type: 'string' },
          },
        },
      },
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ summary: 'Server error: Claude API key not configured.', extracted: {} });
  }

  const { base64Data, mimeType, fileName } = req.body || {};
  if (!base64Data) {
    return res.status(400).json({ summary: 'No document data received.', extracted: {} });
  }

  // PDFs go in a document block; images (screenshots, photos) in an image block.
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
        max_tokens: 2000,
        tools: [EXTRACT_TOOL],
        tool_choice: { type: 'tool', name: 'extract_mortgage_data' },
        messages: [
          {
            role: 'user',
            content: [
              mediaBlock,
              {
                type: 'text',
                text:
                  `This is a mortgage-related document or image (filename: ${fileName || 'unknown'}). ` +
                  'It may be a Closing Disclosure (CD), Loan Estimate (LE), purchase agreement, AUS findings, ' +
                  'credit report, paystub, W-2, or appraisal. Read it carefully and call extract_mortgage_data ' +
                  'with every field you can find. On a CD or LE, be sure to capture the Loan Amount, Interest Rate, ' +
                  'and Closing Date from the Loan Terms and Costs at Closing sections. ' +
                  'Only include fields actually present in the document — do not guess.',
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Claude API error:', data.error);
      return res
        .status(200)
        .json({ summary: `Error: ${data.error.message || data.error}`, extracted: {} });
    }

    // Pull the forced tool call — its input is guaranteed-valid JSON matching the schema.
    const toolUse = (data.content || []).find((b) => b.type === 'tool_use');
    const input = toolUse?.input || {};
    const { summary, ...extracted } = input;

    return res.status(200).json({
      summary: summary || 'Document analyzed.',
      extracted,
    });
  } catch (e) {
    console.error('analyze-document error:', e);
    return res.status(200).json({ summary: `Error analyzing document: ${e.message}`, extracted: {} });
  }
}
