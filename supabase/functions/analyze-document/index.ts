import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')
    if (!CLAUDE_API_KEY) {
      return new Response(JSON.stringify({ error: 'Claude API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { base64Data, mimeType, fileName } = await req.json()

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

Document filename: ${fileName}`

    const isPDF = mimeType === 'application/pdf'

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        ...(isPDF ? { 'anthropic-beta': 'pdfs-2024-09-25' } : {}),
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
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
      }),
    })

    const data = await response.json()
    console.log('Claude raw response:', JSON.stringify(data).substring(0, 500))

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const text = data.content?.[0]?.text || ''

    // Parse response
    const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=JSON:|$)/)
    const jsonMatch = text.match(/JSON:\s*(\{[\s\S]*\})/)

    const summary = summaryMatch?.[1]?.trim() || 'Document analyzed.'
    let extracted = {}
    try {
      if (jsonMatch?.[1]) {
        extracted = JSON.parse(jsonMatch[1])
      }
    } catch (e) {
      console.warn('Could not parse extracted JSON')
    }

    return new Response(JSON.stringify({ summary, extracted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
