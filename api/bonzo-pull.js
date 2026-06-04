import { createClient } from '@supabase/supabase-js';

const BONZO_API_URL = 'https://api.bonzo.io/v1';
const BONZO_TOKEN = process.env.BONZO_API_TOKEN;

// Supabase connection
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Map Bonzo stage to CLOSIO stage
const mapStage = (bonzoStage) => {
  const stageMap = {
    'aged working': 'Working',
    'working': 'Working',
    'new lead': 'Working',
    'new leads': 'Working',
    'dr - leads': 'Working',
    'shopping': 'Shopping',
    'processing': 'Processing',
    'funded': 'Funded',
    'lp ready': 'LP Ready',
    'paycom': 'Paycom',
    'future deal': 'Future Deal',
    'credit upgrade': 'Credit Upgrade',
    'cxld': 'CXLD',
    'cancelled': 'CXLD',
  };
  const lower = (bonzoStage || '').toLowerCase();
  return stageMap[lower] || 'Working';
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!BONZO_TOKEN) {
    return res.status(500).json({ error: 'Bonzo API token not configured' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured. Add SUPABASE_URL and SUPABASE_SERVICE_KEY env vars.' });
  }

  try {
    // Fetch prospects from Bonzo
    const response = await fetch(`${BONZO_API_URL}/prospects?per_page=100`, {
      headers: {
        'Authorization': `Bearer ${BONZO_TOKEN}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Bonzo API error:', response.status, errText);
      return res.status(response.status).json({ error: `Bonzo API error: ${response.status}` });
    }

    const bonzoData = await response.json();
    const prospects = bonzoData.data || bonzoData || [];

    console.log(`Fetched ${prospects.length} prospects from Bonzo`);

    const results = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (const p of prospects) {
      try {
        const firstName = p.first_name || '';
        const lastName = p.last_name || '';
        const name = lastName ? `${lastName}, ${firstName}` : firstName;
        const phone = p.phone || p.mobile || '';
        const email = p.email || '';

        if (!name && !phone && !email) {
          results.skipped++;
          continue;
        }

        // Check for existing borrower
        let existingBorrower = null;
        if (phone) {
          const cleanPhone = phone.replace(/\D/g, '').slice(-10);
          const { data: byPhone } = await supabase
            .from('borrowers')
            .select('*')
            .or(`phone.ilike.%${cleanPhone}%,bonzo_id.eq.${p.id}`)
            .limit(1);
          if (byPhone?.length) existingBorrower = byPhone[0];
        }
        if (!existingBorrower && email) {
          const { data: byEmail } = await supabase
            .from('borrowers')
            .select('*')
            .ilike('email', email)
            .limit(1);
          if (byEmail?.length) existingBorrower = byEmail[0];
        }

        // Build borrower data
        const borrowerData = {
          name: name || undefined,
          phone: phone || undefined,
          email: email || undefined,
          stage: mapStage(p.pipeline?.stage || p.stage),
          loan_purpose: p.loan_purpose || p.mortgage?.loan_purpose || undefined,
          loan_type: p.loan_type || p.mortgage?.loan_type || undefined,
          purchase_price: parseFloat(p.purchase_price || p.mortgage?.purchase_price) || undefined,
          loan_amount: parseFloat(p.loan_amount || p.mortgage?.loan_amount) || undefined,
          rate: parseFloat(p.interest_rate || p.mortgage?.interest_rate) || undefined,
          rate_status: p.rate_is_locked === 'Yes' || p.mortgage?.rate_is_locked === 'Yes' ? 'Locked' : undefined,
          coe_date: p.close_date || p.mortgage?.close_date || undefined,
          lender: p.lender || p.mortgage?.lender || undefined,
          property_address: [
            p.property_address || p.address,
            p.property_city || p.city,
            p.property_state || p.state,
            p.property_zip || p.zip
          ].filter(Boolean).join(', ') || undefined,
          occupancy: p.property_use || p.mortgage?.property_use || undefined,
          bonzo_id: String(p.id),
          updated_at: new Date().toISOString(),
        };

        // Remove undefined values
        Object.keys(borrowerData).forEach(k => {
          if (borrowerData[k] === undefined) delete borrowerData[k];
        });

        if (existingBorrower) {
          // Only update if there's new data
          const { error } = await supabase
            .from('borrowers')
            .update(borrowerData)
            .eq('id', existingBorrower.id);
          if (error) throw error;
          results.updated++;
        } else {
          borrowerData.last_touched = new Date().toISOString();
          borrowerData.is_new = true; // Mark as new for hot pink badge
          const { error } = await supabase
            .from('borrowers')
            .insert([borrowerData]);
          if (error) throw error;
          results.created++;
        }
      } catch (e) {
        console.error('Error processing prospect:', p.id, e.message);
        results.errors.push({ id: p.id, error: e.message });
      }
    }

    console.log('Bonzo pull results:', results);
    return res.status(200).json({
      success: true,
      total: prospects.length,
      ...results
    });

  } catch (e) {
    console.error('Bonzo pull error:', e);
    return res.status(500).json({ error: e.message });
  }
}
