const CLAUDE_MODEL = 'claude-opus-4-5';
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Use Vercel serverless for chat (small payloads)
const callClaude = async (body) => {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
};

// Use Supabase Edge Function for documents (large payloads)
const analyzeWithSupabase = async (base64Data, mimeType, fileName) => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/hyper-handler`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ base64Data, mimeType, fileName }),
  });
  return response.json();
};

export const claudeService = {
  // AI Chat with pipeline context
  async chat(messages, pipelineContext = '') {
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
- Answering questions about lender guidelines from your uploaded Matrix PDFs

IMPORTANT: For lender guideline questions, ONLY use the LENDER GUIDELINES data provided below. Do NOT make up lenders or guidelines. If the answer is not in your uploaded matrices, say "I don't have that lender's guidelines uploaded. Please upload their matrix PDF."

Be concise, professional, and use mortgage industry terminology correctly.
NEVER use emojis in your responses.
If asked for "quick apply link" or "apply link" or "application link", respond ONLY with: https://mortgagewithregnier.com/ApplyNow
If asked for "smart pay" or "smartpay", respond with ONLY these two lines (no headers, no dashes, no extra text):
[Get Started...click here](https://credit.advcredit.com/smartpay/SmartPay.aspx?uid=0c9eb1f6-559e-48e8-bca4-e9617f65f8d2)
https://credit.advcredit.com/smartpay/SmartPay.aspx?uid=0c9eb1f6-559e-48e8-bca4-e9617f65f8d2
"p/w" means password, "u/n" means username
Stored credentials format: "SystemName Username / Password" (e.g., "NMLS RegnierD / R3gni3r123!!")
When user asks "X u/n & p/w", return the stored username and password for system X from the context.
When user corrects you ("wrong", "fix it", "no it's", "actually it's"), the correction is automatically saved.
Format responses for easy reading:
- Use bullet points for lists
- Put each lender or borrower on its own line
- Keep responses short and scannable
- Avoid walls of text
If asked to open a tab, respond with "NAVIGATE:TabName" (e.g., "NAVIGATE:Rate Retread" or "NAVIGATE:Matrix").`;

      const data = await callClaude({
        model: CLAUDE_MODEL,
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      });

      return data.content?.[0]?.text || 'No response received.';
    } catch (e) {
      console.error('Claude chat error:', e);
      throw e;
    }
  },

  // Analyze uploaded document and extract mortgage data
  async analyzeDocument(base64Data, mimeType, fileName) {
    // Use Supabase Edge Function (no size limit)
    try {
      const result = await analyzeWithSupabase(base64Data, mimeType, fileName);
      console.log('Supabase analyze result:', result);
      if (result.error) {
        return { summary: `Error: ${result.error.message || result.error}`, extracted: {} };
      }
      return result;
    } catch (e) {
      console.error('Supabase analyze error:', e);
      return { summary: 'Error analyzing document.', extracted: {} };
    }
  },

  // Legacy direct Claude call (kept for reference)
  async analyzeDocumentDirect(base64Data, mimeType, fileName) {
    const docPrompt = `Analyze this mortgage document. Extract all relevant information and respond in this EXACT format:

SUMMARY: [2-3 sentence summary of document type and key findings]
JSON: [valid JSON object with only fields you found, from this list:
  purchase_price, loan_amount, loan_type, rate, ltv, dti,
  coe_date, seller_cc, earnest_money, occupancy, income_type,
  appraisal_value, appraisal_type, appraisal_subject_to, appraisal_reinspection,
  buyer_agent_name, buyer_agent_phone, buyer_agent_email, buyer_agent_company,
  listing_agent_name, listing_agent_phone, listing_agent_email, listing_agent_company,
  title_company, title_company_phone, title_company_email,
  inspection_contingency_date, appraisal_contingency_date,
  loan_contingency_date, seller_home_sale_contingency_date,
  gross_income, ytd_income, assets, agi,
  approval_status, conditions,
  contingencies (array of {name, due_date, fully_executed}),
  incomes (array of {person, employment_type, income_type, employer, gross_monthly, pay_frequency})
]

Document filename: ${fileName}`;

    try {
      const isPDF = mimeType === 'application/pdf';

      const data = await callClaude({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        isPDF,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mimeType || 'application/pdf',
                data: base64Data
              }
            },
            { type: 'text', text: docPrompt }
          ],
        }],
      });

      console.log('Claude API response:', data);

      if (data.error) {
        console.error('Claude API error:', data.error);
        return { summary: `API Error: ${data.error.message || data.error}`, extracted: {} };
      }

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
    const data = await callClaude({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      system: `You are a mortgage lender guideline expert. Answer questions based on the following lender matrix data:

${matrixContext}

Give clear, specific answers with guideline details. Use plain English.`,
      messages: [{ role: 'user', content: question }],
    });

    return data.content?.[0]?.text || 'No response.';
  },
};
