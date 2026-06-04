import { createClient } from '@supabase/supabase-js';

const BONZO_API_URL = 'https://app.getbonzo.com/api/v3';
const BONZO_TOKEN = process.env.BONZO_API_TOKEN;

// Supabase connection
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ONLY these Bonzo stages get imported (null = skip)
// Returns { stage, substage } or null to skip
const mapBonzoStage = (bonzoStage) => {
  const lower = (bonzoStage || '').toLowerCase().trim();

  // Check for keyword matches (more flexible)
  if (lower.includes('stips needed') || lower.includes('need stips')) {
    if (lower.includes('approved')) return { stage: 'Shopping', substage: 'Stips Needed' };
    return { stage: 'Working', substage: 'Stips Needed' };
  }
  if (lower.includes('working') || lower === 'hot') return { stage: 'Working', substage: null };
  if (lower.includes('pre-approved') || lower.includes('shopping')) return { stage: 'Shopping', substage: null };
  if (lower.includes('processing')) return { stage: 'Processing', substage: null };
  if (lower.includes('closed') || lower.includes('funded')) return { stage: 'Funded', substage: null };
  if (lower.includes('future deal') || lower.includes('future')) return { stage: 'Future Deal', substage: null };

  return null; // null = don't import
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

        // Skip if no name (phone-only leads are not real borrowers)
        if (!name || !name.trim()) {
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

        // Skip realtors/agents - only import borrowers
        const prospectTypeRaw = p.prospect_type?.name || p.prospect_type || p.type?.name || p.type || '';
        const prospectType = (typeof prospectTypeRaw === 'string' ? prospectTypeRaw : '').toLowerCase();
        if (prospectType.includes('realtor') || prospectType.includes('agent')) {
          results.skipped++;
          continue;
        }

        // Check if this Bonzo stage should be imported
        // Debug first prospect to see full structure
        if (results.created + results.updated + results.skipped === 0) {
          console.log('FIRST PROSPECT FULL:', JSON.stringify(p, null, 2).slice(0, 2000));
        }

        const bonzoStageName = p.pipeline?.stage?.name || p.pipeline?.stage || p.pipeline_stage?.name || p.pipeline_stage || p.stage?.name || p.stage || '';
        const stageMapping = mapBonzoStage(bonzoStageName);

        // Skip if stage not in our import list (unless already exists in CLOSIO)
        let existingBorrowerCheck = null;
        if (phone) {
          const cleanPhone = phone.replace(/\D/g, '').slice(-10);
          const { data: byPhone } = await supabase
            .from('borrowers')
            .select('id')
            .or(`phone.ilike.%${cleanPhone}%,bonzo_id.eq.${p.id}`)
            .limit(1);
          if (byPhone?.length) existingBorrowerCheck = byPhone[0];
        }

        if (!stageMapping && !existingBorrowerCheck) {
          // Stage not importable and not already in CLOSIO - skip
          console.log('SKIP:', name, 'stage:', bonzoStageName);
          results.skipped++;
          continue;
        }

        // Build borrower data - pull ALL fields from Bonzo
        const mortgage = p.mortgage || {};
        const borrowerData = {
          name: name || undefined,
          phone: phone || undefined,
          email: email || undefined,
          stage: stageMapping?.stage || 'Working',
          substage: stageMapping?.substage || null,
          loan_purpose: mortgage.loan_purpose || p.loan_purpose || undefined,
          loan_type: mortgage.loan_type || p.loan_type || undefined,
          purchase_price: parseFloat(mortgage.purchase_price || p.purchase_price) || undefined,
          loan_amount: parseFloat(mortgage.loan_amount || p.loan_amount) || undefined,
          rate: parseFloat(mortgage.interest_rate || p.interest_rate) || undefined,
          rate_status: (mortgage.rate_is_locked === 'Yes' || p.rate_is_locked === 'Yes') ? 'Locked' : undefined,
          coe_date: mortgage.close_date || p.close_date || undefined,
          lender: mortgage.lender || p.lender || undefined,
          property_address: [
            mortgage.property_address || p.property_address || p.address,
            mortgage.property_city || p.property_city || p.city,
            mortgage.property_state || p.property_state || p.state,
            mortgage.property_zip || p.property_zip || p.zip
          ].filter(Boolean).join(', ') || undefined,
          occupancy: mortgage.property_use || p.property_use || undefined,
          property_type: mortgage.property_type || p.property_type || undefined,
          credit_score: parseInt(mortgage.credit_score || p.credit_score) || undefined,
          bonzo_id: String(p.id),
          bonzo_last_sync: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Extra Bonzo fields for borrower card
          lead_source: p.lead_source || p.source || undefined,
          birthday: p.birthday || p.date_of_birth || undefined,
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
