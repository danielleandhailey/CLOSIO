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
      co_borrowers: { type: 'array', items: { type: 'string' }, description: 'Co-borrower full names — ONLY people who are actual borrowers on the loan/application. Do NOT include a spouse who is on title but not borrowing.' },
      non_borrowing_spouse: { type: 'string', description: 'A spouse who is on title or the contract but is NOT a borrower on the loan. Put such a person here, NOT in co_borrowers.' },
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
      negative_items: {
        type: 'array',
        description: 'The actual derogatory/negative accounts on the report.',
        items: { type: 'object', properties: {
          creditor: { type: 'string' }, type: { type: 'string', description: 'e.g. Collection, Late Payment, Charge-off' },
          status: { type: 'string' }, balance: { type: 'number' }, date: { type: 'string' },
          last_late_date: { type: 'string', description: 'For a late payment, the most recent month reported late (YYYY-MM)' },
          rolling: { type: 'boolean', description: 'For late payments: true if the account has consecutive/ongoing recent lates (rolling)' },
        } },
      },
      public_record_items: {
        type: 'array',
        description: 'Public records (bankruptcies, liens, judgments). For a bankruptcy, include the chapter in "type" and the discharge date.',
        items: { type: 'object', properties: {
          type: { type: 'string', description: 'e.g. Chapter 7 Bankruptcy, Chapter 13 Bankruptcy, Tax Lien, Judgment' },
          filed_date: { type: 'string', description: 'YYYY-MM-DD' },
          discharge_date: { type: 'string', description: 'Discharge/dismissed date, YYYY-MM-DD' },
          status: { type: 'string' }, amount: { type: 'number' },
        } },
      },
      credit_people: {
        type: 'array',
        description: 'For a credit report covering MORE THAN ONE person (e.g. a joint married report with 6 scores), one entry per person with their own scores. For a single-person report this may be omitted.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            fico_equifax: { type: 'number' },
            fico_experian: { type: 'number' },
            fico_transunion: { type: 'number' },
            vantage_equifax: { type: 'number' },
            vantage_experian: { type: 'number' },
            vantage_transunion: { type: 'number' },
            negative_marks: { type: 'number' },
            public_records: { type: 'number' },
            negative_items: { type: 'array', items: { type: 'object', properties: {
              creditor: { type: 'string' }, type: { type: 'string' }, status: { type: 'string' }, balance: { type: 'number' }, date: { type: 'string' },
            } } },
            public_record_items: { type: 'array', items: { type: 'object', properties: {
              type: { type: 'string' }, filed_date: { type: 'string' }, discharge_date: { type: 'string' }, status: { type: 'string' }, amount: { type: 'number' },
            } } },
          },
        },
      },

      // Loan terms
      purchase_price: { type: 'number', description: 'Sale / purchase price in dollars' },
      loan_amount: { type: 'number', description: 'Total loan / note amount in dollars. On a Closing Disclosure or Loan Estimate this is "Loan Amount" in the Loan Terms box.' },
      loan_type: { type: 'string', description: 'Loan PROGRAM only: Conventional, FHA, VA, USDA, Jumbo, Non-QM, HELOC, or Reverse. NOT the purpose.' },
      loan_purpose: { type: 'string', description: 'Loan purpose: Purchase, Refinance, or Cash-Out Refinance.' },
      rate: { type: 'number', description: 'Interest rate as a percent number, e.g. 6.875. On a CD/LE this is "Interest Rate" in the Loan Terms box.' },
      apr: { type: 'number', description: 'Annual Percentage Rate (APR) as a percent number. On a Closing Disclosure it is in the "Loan Calculations" section (page 5).' },
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
      lender_ae_name: { type: 'string', description: 'ONLY the wholesale/lender Account Executive (AE) at the mortgage lender. Do NOT use real-estate agents, settlement/title agents, buyers, or sellers. Omit unless an actual lender AE is named.' },
      lender_ae_phone: { type: 'string' },
      lender_ae_email: { type: 'string' },
      lender_ae_company: { type: 'string' },
      underwriter_name: { type: 'string', description: 'ONLY the loan underwriter at the lender. Do NOT use agents, processors, buyers, or sellers. Omit unless someone is explicitly identified as the underwriter.' },
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
            employment_type: { type: 'string', description: 'W2, Self-Employed, etc.' },
            income_type: { type: 'string' },
            employer: { type: 'string' },
            gross_monthly: { type: 'number' },
            pay_frequency: { type: 'string', description: 'weekly, bi-weekly, semi-monthly, or monthly. READ the actual frequency from THIS paystub — do not assume. Use whatever the document shows: an explicit pay-frequency field, the pay-period start/end dates, the pay/check dates, and any period count (e.g. "period 11 of 26"). Bi-weekly = paid every 2 weeks (26/yr); semi-monthly = twice a month on fixed dates like the 1st & 15th (24/yr); weekly = 52; monthly = 12. It varies by employer and person, so determine it from the evidence on this specific document.' },
            pay_period_start: { type: 'string', description: 'Pay period START date, YYYY-MM-DD' },
            pay_period_end: { type: 'string', description: 'Pay period END date, YYYY-MM-DD' },
            amount_per_period: { type: 'number', description: 'Gross pay for ONE pay period (this paystub gross)' },
            ytd_gross: { type: 'number', description: 'Year-to-date gross earnings' },
            ytd_as_of_date: { type: 'string', description: 'Pay date / period end for the YTD figure, YYYY-MM-DD' },
            category: { type: 'string', description: 'base, overtime, bonus, commission, or other' },
            hourly_rate: { type: 'number' },
            hours_per_period: { type: 'number' },
            doc_type: { type: 'string', description: 'What kind of doc this income line came from: "paystub", "w2", "voe", "tax_return", or "other". A W-2 form = "w2"; a pay stub = "paystub".' },
            tax_year: { type: 'number', description: 'For a W-2: the tax year (e.g. 2024).' },
            annual_wages: { type: 'number', description: 'For a W-2: the annual gross wages — use Box 5 (Medicare wages) if present, else Box 1.' },
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
                  'If this is a paystub, W-2, VOE, or otherwise shows employment earnings, you MUST fill the ' +
                  'incomes array — one entry per earner — including person, employer, employment_type, pay_frequency, ' +
                  'amount_per_period (the current-period gross), ytd_gross, ytd_as_of_date (the pay/period date), and category. ' +
                  'ALWAYS set doc_type: "paystub" for a pay stub, "w2" for a W-2 form. For a W-2 ALSO set tax_year and ' +
                  'annual_wages (Box 5 Medicare wages, else Box 1) — do NOT put W-2 annual wages in amount_per_period or ytd_gross. ' +
                  'For a paystub ALWAYS capture pay_period_start and pay_period_end, and set pay_frequency from those dates: ' +
                  '7-day period = Weekly (52/yr); 14-day period = Bi-Weekly (26/yr); 1st-15th or 16th-end = Semi-Monthly (24/yr); ' +
                  'full month = Monthly (12/yr). Cross-check by dividing YTD gross by the current-period gross to estimate periods elapsed. ' +
                  'For a CREDIT REPORT: put bankruptcies, tax liens, and judgments in public_record_items ' +
                  '(with filed_date and discharge_date) — NOT in negative_items. Put tradeline derogatories ' +
                  '(collections, charge-offs, late payments) in negative_items; for late payments include ' +
                  'last_late_date and whether they are rolling. ' +
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
