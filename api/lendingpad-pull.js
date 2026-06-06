import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// LendingPad API credentials
const LP_API_KEY = '151e374c-696b-4295-ae9b-22b10f099f67';
const LP_COMPANY_ID = '5e3a84bf-dc14-4e78-85b7-5373ca0e2824';
const LP_BRANCH_ID = '92bfdf32-0717-4229-9028-e6621a754cff';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!supabase) {
    return res.status(500).json({ error: 'Missing Supabase config' });
  }

  try {
    // Try LendingPad API - common endpoint patterns
    const baseUrl = 'https://prod.lendingpad.com/api';

    // Attempt to fetch loans
    const response = await fetch(`${baseUrl}/v1/loans`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LP_API_KEY}`,
        'X-API-Key': LP_API_KEY,
        'X-Company-Id': LP_COMPANY_ID,
        'X-Branch-Id': LP_BRANCH_ID,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // Try alternative endpoint
      const altResponse = await fetch(`${baseUrl}/loans`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LP_API_KEY}`,
          'X-API-Key': LP_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!altResponse.ok) {
        const errorText = await altResponse.text();
        return res.status(200).json({
          success: false,
          error: 'API endpoint not found - may need LendingPad docs',
          status: altResponse.status,
          details: errorText.substring(0, 500)
        });
      }

      const altData = await altResponse.json();
      return res.status(200).json({ success: true, data: altData, source: 'alt' });
    }

    const data = await response.json();

    // Process and save to Supabase
    let created = 0;
    let updated = 0;

    if (data.loans && Array.isArray(data.loans)) {
      for (const loan of data.loans) {
        // Check if borrower exists by name or LP ID
        const { data: existing } = await supabase
          .from('borrowers')
          .select('id')
          .or(`lendingpad_id.eq.${loan.id},name.ilike.%${loan.borrowerName}%`)
          .single();

        const borrowerData = {
          name: loan.borrowerName || loan.borrower_name,
          email: loan.email,
          phone: loan.phone,
          loan_amount: loan.loanAmount || loan.loan_amount,
          purchase_price: loan.purchasePrice || loan.purchase_price,
          rate: loan.rate,
          stage: mapLPStage(loan.status || loan.stage),
          lender: loan.lender,
          loan_type: loan.loanType || loan.loan_type,
          property_address: loan.propertyAddress || loan.property_address,
          lendingpad_id: loan.id,
          lendingpad_last_sync: new Date().toISOString(),
        };

        if (existing) {
          await supabase.from('borrowers').update(borrowerData).eq('id', existing.id);
          updated++;
        } else {
          await supabase.from('borrowers').insert([borrowerData]);
          created++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      created,
      updated,
      total: data.loans?.length || 0
    });

  } catch (e) {
    return res.status(500).json({ error: e.message, success: false });
  }
}

// Map LendingPad stages to Closio stages
function mapLPStage(lpStage) {
  const stageMap = {
    'Application': 'Working',
    'Processing': 'Processing',
    'Underwriting': 'Processing',
    'Approved': 'LP Ready',
    'Clear to Close': 'LP Ready',
    'Closing': 'Processing',
    'Funded': 'Funded',
    'Closed': 'Closed/Paid',
    'Denied': 'DNQ',
    'Withdrawn': 'CXLD',
  };
  return stageMap[lpStage] || 'Working';
}
