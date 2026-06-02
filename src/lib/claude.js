const CLAUDE_API_KEY = process.env.REACT_APP_CLAUDE_API_KEY;
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';

export const claudeService = {
  // AI Chat with pipeline context
  async chat(messages, pipelineContext = '') {
    if (!CLAUDE_API_KEY) {
      return 'Claude API key not configured. Please add REACT_APP_CLAUDE_API_KEY to your environment.';
    }

    try {
      const systemPrompt = `You are the CLOSIO™ AI assistant for a mortgage pipeline management platform. 
You have access to the following live pipeline data:

${pipelineContext}

You help Loan Officers and Loan Officer Assistants (LOAs) by:
- Answering questions about specific borrowers by name
- Identifying who needs stipulations or conditions
- Showing floating vs locked borrowers
- Listing COE dates and contingencies
- Summarizing which borrowers are in each stage
- Flagging urgent tasks or overdue items
- Answering questions about lender guidelines from the Matrix

Be concise, professional, and use mortgage industry terminology correctly.
If asked to open a tab, respond with "NAVIGATE:TabName" (e.g., "NAVIGATE:Rate Retread" or "NAVIGATE:Matrix").`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1000,
          system: systemPrompt,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();
      return data.content?.[0]?.text || 'No response received.';
    } catch (e) {
      console.error('Claude chat error:', e);
      throw e;
    }
  },

  // Analyze uploaded document and extract mortgage data
  async analyzeDocument(base64Data, mimeType, fileName) {
    if (!CLAUDE_API_KEY) {
      return { summary: 'AI analysis not available — Claude API key not configured.', extracted: {} };
    }

    const docPrompt = `You are analyzing a mortgage document. Extract all relevant information and provide:

1. A SUMMARY (2-3 sentences) of what this document is and key findings
2. EXTRACTED DATA in JSON format with these possible fields:
   - gross_income (monthly, number)
   - ytd_income (number)
   - assets (number)
   - bank_balance (number)
   - agi (annual gross income, number)
   - approval_status (string)
   - dti (percentage, number)
   - ltv (percentage, number)
   - conditions (array of strings)
   - appraisal_value (number)
   - repairs_required (array of strings)
   - purchase_price (number)
   - buyer_agent_name (string)
   - buyer_agent_phone (string)
   - title_company (string)
   - inspection_contingency_date (date string)
   - loan_contingency_date (date string)
   - appraisal_contingency_date (date string)
   - coe_date (date string)
   - appraisal_type (string - e.g. "Conventional 1004 Single family residence", "2075 Drive By", "FHA 1004 Single family residence", etc.)
   - appraisal_subject_to (string - any conditions or repairs the appraiser noted as "subject to")
   - appraisal_reinspection (boolean - true if a reinspection is required)
   - contingencies (array of objects with: name, due_date, fully_executed - for Purchase Agreements extract ALL contingencies including from counter offers. Mark fully_executed as false if signatures are missing or dates are blank)
   - incomes (array of objects for VOE, paystubs, tax returns with: person (Borrower or Co-Borrower), employment_type (W2, Self-Employed, Retired, No Income (DSCR), Other), income_type (401K/IRA, Alimony, Social Security, Pension, etc.), employer, gross_monthly, pay_frequency (Monthly, Bi-Weekly, Weekly, Semi-Monthly, Annual))

Document filename: ${fileName}

Respond in this exact format:
SUMMARY: [your summary here]
JSON: [valid JSON object with only the fields you found]`;

    try {
      const isPDF = mimeType === 'application/pdf';
      const contentBlock = isPDF
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
        : { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } };

      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      };
      if (isPDF) headers['anthropic-beta'] = 'pdfs-2024-09-25';

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: [contentBlock, { type: 'text', text: docPrompt }],
          }],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      // Parse response
      const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=JSON:|$)/);
      const jsonMatch = text.match(/JSON:\s*(\{[\s\S]*\})/);

      const summary = summaryMatch?.[1]?.trim() || 'Document analyzed.';
      let extracted = {};
      try {
        if (jsonMatch?.[1]) {
          extracted = JSON.parse(jsonMatch[1]);
        }
      } catch (e) {
        console.warn('Could not parse extracted JSON');
      }

      return { summary, extracted };
    } catch (e) {
      console.error('Claude document analysis error:', e);
      return { summary: 'Error analyzing document.', extracted: {} };
    }
  },

  // Matrix Q&A
  async matrixQuery(question, matrixContext) {
    if (!CLAUDE_API_KEY) {
      return 'Claude API key not configured.';
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 800,
        system: `You are a mortgage lender guideline expert. Answer questions based on the following lender matrix data:

${matrixContext}

Give clear, specific answers with guideline details. Use plain English.`,
        messages: [{ role: 'user', content: question }],
      }),
    });

    const data = await response.json();
    return data.content?.[0]?.text || 'No response.';
  },
};
