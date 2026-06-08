import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Read env vars inside handler (required for Vercel)
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { fileUrl, matrixId, lenderName } = req.body;

  if (!fileUrl || !matrixId) {
    return res.status(400).json({ error: 'Missing fileUrl or matrixId' });
  }

  try {
    // Fetch the PDF
    const pdfResponse = await fetch(fileUrl);
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

    // Use Claude to extract and summarize the PDF content
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: `Extract and summarize all key lending guidelines from this ${lenderName || 'lender'} matrix/guideline document. Include:
- Loan types offered
- Credit score requirements (min scores, tiers)
- DTI limits
- LTV limits
- Property types allowed
- Income documentation requirements
- Asset requirements
- Any unique programs or exceptions
- Rate/pricing info if available

Format as clear, searchable bullet points. Be thorough - this will be used to answer questions about the lender's guidelines.`
            }
          ]
        }]
      })
    });

    const claudeData = await claudeResponse.json();
    const extractedText = claudeData.content?.[0]?.text || '';

    if (!extractedText) {
      return res.status(500).json({ error: 'Failed to extract PDF content' });
    }

    // Update the matrix record with the extracted/indexed content
    const { error: updateError } = await supabase
      .from('lender_matrices')
      .update({ ai_index: extractedText })
      .eq('id', matrixId);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({ success: true, indexed: extractedText.substring(0, 500) + '...' });

  } catch (e) {
    console.error('PDF parse error:', e);
    return res.status(500).json({ error: e.message });
  }
}
