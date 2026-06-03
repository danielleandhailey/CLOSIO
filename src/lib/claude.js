import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.entry';

// Set worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';

// Use serverless function to avoid CORS
const callClaude = async (body) => {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
};

// Extract text from PDF using PDF.js
const extractPDFText = async (base64Data) => {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `\n--- Page ${i} ---\n${pageText}`;
    }

    return fullText;
  } catch (e) {
    console.error('PDF text extraction error:', e);
    return null;
  }
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
- Answering questions about lender guidelines from the Matrix

Be concise, professional, and use mortgage industry terminology correctly.
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
   - loan_amount (number)
   - earnest_money (number - earnest money deposit amount)
   - seller_cc (number - seller credits/concessions)
   - buyer_agent_name (string)
   - buyer_agent_phone (string)
   - buyer_agent_email (string)
   - buyer_agent_company (string)
   - listing_agent_name (string)
   - listing_agent_phone (string)
   - listing_agent_email (string)
   - listing_agent_company (string)
   - title_company (string)
   - title_company_phone (string)
   - title_company_email (string)
   - inspection_contingency_date (date string)
   - loan_contingency_date (date string)
   - appraisal_contingency_date (date string)
   - coe_date (date string)
   - appraisal_type (string)
   - appraisal_subject_to (string)
   - appraisal_reinspection (boolean)
   - contingencies (array of objects with: name, due_date, fully_executed)
   - incomes (array of objects with: person, employment_type, income_type, employer, gross_monthly, pay_frequency)

Document filename: ${fileName}

Respond in this exact format:
SUMMARY: [your summary here]
JSON: [valid JSON object with only the fields you found]`;

    try {
      const isPDF = mimeType === 'application/pdf';
      let messages;

      if (isPDF) {
        // Extract text from PDF first (avoids size limits)
        console.log('Extracting text from PDF...');
        const pdfText = await extractPDFText(base64Data);

        if (pdfText && pdfText.length > 100) {
          console.log(`Extracted ${pdfText.length} chars from PDF`);
          // Send text instead of PDF binary
          messages = [{
            role: 'user',
            content: `${docPrompt}\n\n--- DOCUMENT TEXT ---\n${pdfText.slice(0, 50000)}`, // Limit to 50k chars
          }];
        } else {
          // Fallback to sending PDF if text extraction failed
          console.log('Text extraction failed, sending PDF binary...');
          messages = [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
              { type: 'text', text: docPrompt }
            ],
          }];
        }
      } else {
        // Image - send as-is
        messages = [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } },
            { type: 'text', text: docPrompt }
          ],
        }];
      }

      const data = await callClaude({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        isPDF: isPDF && (!messages[0].content || typeof messages[0].content === 'string'),
        messages,
      });

      console.log('Claude API response:', data);

      if (data.error) {
        console.error('Claude API error:', data.error);
        return { summary: `API Error: ${data.error}`, extracted: {} };
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
