import { createClient } from '@supabase/supabase-js';
import { getBonzoToken } from '../lib/bonzoToken';

const BONZO_API_URL = 'https://app.getbonzo.com/api/v3';

// Supabase connection
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ONLY these Bonzo stages get imported (null = skip)
// Returns { stage, substage, tag, autoNote } or null to skip
const mapBonzoStage = (bonzoStage, pipelineName) => {
  const lower = (bonzoStage || '').toLowerCase().trim();
  const pipeline = (pipelineName || '').toLowerCase();

  // DR - Purchase pipeline stages
  if (pipeline.includes('purchase')) {
    if (lower === 'hot!') return { stage: 'HOT', substage: null };
    if (lower === 'stips needed') return { stage: 'Working', substage: 'Stips Needed' };
    if (lower === 'working') return { stage: 'Working', substage: null };
    if (lower === 'credit repair') return { stage: 'Credit Upgrade', substage: null };
    if (lower === 'approved - need stips') return { stage: 'Shopping', substage: 'Stips Needed' };
    if (lower === 'pre-approved - shopping') return { stage: 'Shopping', substage: null };
    if (lower === 'in processing') return { stage: 'Processing', substage: null };
    if (lower === 'reverse mtg') return { stage: 'Working', substage: null, tag: 'Reverse' };
    if (lower === 'closed / paid') return { stage: 'Closed/Paid', substage: null };
    if (lower === 'funded') return { stage: 'Funded', substage: null };
    if (lower === 'future deal') return { stage: 'Future Deal', substage: null };
    if (lower === 'dnq') return { stage: 'DNQ', substage: null };
    if (lower === 'not interested') return { stage: 'Not Interested', substage: null };
    if (lower === 'stop') return { stage: 'Not Interested', substage: null }; // STOP = Do Not Contact
  }

  // DR - Leads pipeline stages
  if (pipeline.includes('leads')) {
    if (lower === 'working') return { stage: 'Working', substage: null };
    if (lower === 'reverse') return { stage: 'Working', substage: null, tag: 'Reverse' };
    if (lower === 'credit repair') return { stage: 'Credit Upgrade', substage: null };
    if (lower === 'need full app - figure denied' || lower.includes('figure denied')) {
      return { stage: 'Working', substage: null, loanType: 'HELOC', autoNote: '**FIGURE DENIED - NEEDS FULL APP**' };
    }
    if (lower === 'in processing') return { stage: 'Processing', substage: null };
    if (lower === '$$ funded $$' || lower === 'ss funded ss' || lower === 'funded') return { stage: 'Funded', substage: null };
    if (lower === 'future deal') return { stage: 'Future Deal', substage: null };
    if (lower === 'dnq!' || lower === 'dnq') return { stage: 'DNQ', substage: null };
    if (lower === 'went dark') return { stage: 'Went Dark', substage: null };
    if (lower === 'went with competitor') return { stage: 'Went With Competitor', substage: null };
    if (lower === 'not interested') return { stage: 'Not Interested', substage: null };
  }

  // DR - Recycled pipeline (disabled for now - uncomment later)
  // if (pipeline.includes('recycled')) {
  //   if (lower === 'working') return { stage: 'Recycled', substage: null };
  // }

  return null; // null = don't import
};

// Map loan_purpose to loan_type
const mapLoanType = (loanPurpose) => {
  const lower = (loanPurpose || '').toLowerCase().trim();
  if (lower.includes('purchase')) return 'Purchase';
  if (lower.includes('refi') || lower.includes('rate') || lower.includes('term') || lower.includes('r/t')) return 'Refi & R/T';
  if (lower.includes('heloc') || lower.includes('equity')) return 'HELOC';
  return null; // Unknown
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const BONZO_TOKEN = await getBonzoToken();
  if (!BONZO_TOKEN) {
    return res.status(500).json({ error: 'Bonzo API token not configured — add it on the CLOSIO Settings page.' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured. Add SUPABASE_URL and SUPABASE_SERVICE_KEY env vars.' });
  }

  try {
    // Fetch prospects from Bonzo - get multiple pages
    let allProspects = [];
    let page = 1;
    const maxPages = 10; // Fetch 500 - Vercel timeout limits larger pulls

    while (page <= maxPages) {
      const response = await fetch(`${BONZO_API_URL}/prospects?per_page=50&page=${page}&sort=-created_at`, {
        headers: {
          'Authorization': `Bearer ${BONZO_TOKEN}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Bonzo API error:', response.status, errText);
        const msg = response.status === 401
          ? 'Bonzo connection expired or invalid — generate a fresh Bonzo API token and update BONZO_API_TOKEN in Vercel.'
          : `Bonzo API error: ${response.status}`;
        return res.status(response.status).json({ error: msg });
      }

      const bonzoData = await response.json();
      const pageProspects = bonzoData.data || bonzoData || [];

      if (pageProspects.length === 0) break; // No more pages

      allProspects = allProspects.concat(pageProspects);
      console.log(`Fetched page ${page}: ${pageProspects.length} prospects`);

      if (pageProspects.length < 50) break; // Last page (we fetch 50 per page)
      page++;
    }

    const prospects = allProspects;

    console.log(`Fetched ${prospects.length} prospects from Bonzo`);

    const results = { created: 0, updated: 0, skipped: 0, errors: [] };

    // Log first prospect to see structure
    if (prospects.length > 0) {
      console.log('FIRST PROSPECT:', JSON.stringify(prospects[0], null, 2).slice(0, 3000));
    }

    for (const p of prospects) {
      try {
        const firstName = p.first_name || '';
        const lastName = p.last_name || '';
        const name = lastName ? `${lastName}, ${firstName}` : firstName;
        const phone = p.phone || p.mobile || '';
        const email = p.email || '';

        // Check for existing borrower by bonzo_id, phone, or email
        let existingBorrower = null;
        const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';

        // Try bonzo_id first
        const { data: byBonzoId } = await supabase
          .from('borrowers')
          .select('*')
          .eq('bonzo_id', String(p.id))
          .limit(1);
        if (byBonzoId?.length) existingBorrower = byBonzoId[0];

        // Try phone if no bonzo_id match
        if (!existingBorrower && cleanPhone) {
          const { data: byPhone } = await supabase
            .from('borrowers')
            .select('*')
            .ilike('phone', `%${cleanPhone}%`)
            .limit(1);
          if (byPhone?.length) existingBorrower = byPhone[0];
        }

        // Try email if still no match
        if (!existingBorrower && email) {
          const { data: byEmail } = await supabase
            .from('borrowers')
            .select('*')
            .ilike('email', email)
            .limit(1);
          if (byEmail?.length) existingBorrower = byEmail[0];
        }

        // Try name match as last resort (exact, then partial)
        if (!existingBorrower && name) {
          const { data: byName } = await supabase
            .from('borrowers')
            .select('*')
            .ilike('name', name)
            .limit(1);
          if (byName?.length) existingBorrower = byName[0];
        }
        // Try last name + first initial if still no match
        if (!existingBorrower && lastName && firstName) {
          const { data: byPartial } = await supabase
            .from('borrowers')
            .select('*')
            .ilike('name', `${lastName}%${firstName.charAt(0)}%`)
            .limit(1);
          if (byPartial?.length) existingBorrower = byPartial[0];
        }

        // If existing borrower, update fields from Bonzo
        if (existingBorrower) {
          const bonzoStageName = p.pipeline?.stage?.name || p.pipeline?.stage || p.pipeline_stage?.name || p.pipeline_stage || p.stage?.name || p.stage || '';
          const pipelineName = p.pipeline?.name || p.pipeline || '';
          const stageMapping = mapBonzoStage(bonzoStageName, pipelineName);
          const mortgage = p.mortgage || {};
          const loanPurpose = mortgage.loan_purpose || p.loan_purpose || '';

          const updateData = {
            timezone: p.timezone || existingBorrower.timezone,
            bonzo_id: String(p.id),
            bonzo_last_sync: new Date().toISOString(),
            occupancy: mortgage.property_use || p.property_use || existingBorrower.occupancy,
            property_type: mortgage.property_type || p.property_type || existingBorrower.property_type,
            lead_source: p.lead_source || p.source || existingBorrower.lead_source,
            lead_id: p.lead_id || p.external_id || existingBorrower.lead_id,
          };

          // Track if anything meaningful changed
          let hasChanges = false;

          // Sync loan_purpose if Bonzo has it
          if (loanPurpose && loanPurpose !== existingBorrower.loan_purpose) {
            updateData.loan_purpose = loanPurpose;
            hasChanges = true;
          }

          // Sync stage from Bonzo if mapped and different
          if (stageMapping && stageMapping.stage && stageMapping.stage !== existingBorrower.stage) {
            updateData.stage = stageMapping.stage;
            if (stageMapping.substage) updateData.substage = stageMapping.substage;
            hasChanges = true;
          }

          // Sync loan_type (pipeline type) if different
          const loanType = stageMapping?.loanType || mortgage.loan_type || p.loan_type;
          if (loanType && loanType !== existingBorrower.loan_type) {
            updateData.loan_type = loanType;
            hasChanges = true;
          }

          // Only set is_updated if something meaningful changed AND not a new lead
          if (hasChanges && !existingBorrower.is_new) {
            updateData.is_updated = true;
          }

          await supabase
            .from('borrowers')
            .update(updateData)
            .eq('id', existingBorrower.id);
          results.updated++;
          continue;
        }

        // For NEW imports: only from DR - Purchase or DR - Leads pipelines
        const pipelineName = p.pipeline?.name || p.pipeline || '';
        const allowedPipelines = ['DR - Purchase', 'DR - Leads'];
        if (!allowedPipelines.some(ap => pipelineName.includes(ap.replace('DR - ', '')))) {
          results.skipped++;
          continue;
        }

        // Skip if no name
        if (!name || !name.trim()) {
          results.skipped++;
          continue;
        }

        // Skip realtors/agents
        const prospectTypeRaw = p.prospect_type?.name || p.prospect_type || p.type?.name || p.type || '';
        const prospectType = (typeof prospectTypeRaw === 'string' ? prospectTypeRaw : '').toLowerCase();
        if (prospectType.includes('realtor') || prospectType.includes('agent')) {
          results.skipped++;
          continue;
        }

        // Check if this Bonzo stage should be imported
        const bonzoStageName = p.pipeline?.stage?.name || p.pipeline?.stage || p.pipeline_stage?.name || p.pipeline_stage || p.stage?.name || p.stage || '';
        const stageMapping = mapBonzoStage(bonzoStageName, pipelineName);

        if (!stageMapping) {
          // Stage not importable - skip
          console.log('SKIP:', name, '| stage:', bonzoStageName, '| pipeline:', pipelineName);
          results.skipped++;
          continue;
        } else {
          console.log('IMPORT:', name, '| stage:', bonzoStageName, '→', stageMapping.stage, '| pipeline:', pipelineName);
        }

        // Build borrower data - pull ALL fields from Bonzo
        const mortgage = p.mortgage || {};
        const loanPurpose = mortgage.loan_purpose || p.loan_purpose || '';
        // Use stage mapping loanType override, else derive from loan_purpose
        const loanType = stageMapping?.loanType || mapLoanType(loanPurpose);

        const borrowerData = {
          name: name || undefined,
          phone: phone || undefined,
          email: email || undefined,
          stage: stageMapping?.stage || 'Working',
          substage: stageMapping?.substage || null,
          loan_purpose: loanPurpose || undefined,
          loan_type: loanType || undefined,
          // Auto note from stage mapping
          notes: stageMapping?.autoNote || undefined,
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
          bonzo_created_at: p.created_at || undefined,
          updated_at: new Date().toISOString(),
          // Extra Bonzo fields for borrower card
          lead_source: p.lead_source || p.source || undefined,
          lead_id: p.lead_id || p.external_id || String(p.id) || undefined,
          birthday: p.birthday || p.date_of_birth || undefined,
          timezone: p.timezone || undefined,
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
          borrowerData.user_id = 'c75c0dc8-5bf4-4911-9b48-41c94d2e3494'; // Danielle's user_id
          borrowerData.is_new = true; // Mark as new for hot pink badge
          const { data: newBorrower, error } = await supabase
            .from('borrowers')
            .insert([borrowerData])
            .select()
            .single();
          if (error) throw error;

          // Add tag if stage mapping has one
          if (stageMapping?.tag && newBorrower) {
            await supabase.from('borrower_tags').insert({
              borrower_id: newBorrower.id,
              tag: stageMapping.tag
            });
          }

          results.created++;
        }
      } catch (e) {
        console.error('Error processing prospect:', p.id, e.message);
        results.errors.push({ id: p.id, error: e.message });
      }
    }

    const hasMore = prospects.length === 50;
    console.log('Bonzo pull results:', results, 'hasMore:', hasMore);
    return res.status(200).json({
      success: true,
      total: prospects.length,
      hasMore,
      message: hasMore ? 'Pull again for more prospects' : 'All caught up',
      ...results
    });

  } catch (e) {
    console.error('Bonzo pull error:', e);
    return res.status(500).json({ error: e.message });
  }
}
