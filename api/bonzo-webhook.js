import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Map Bonzo stage to CLOSIO stage
const mapStage = (bonzoStage) => {
  const lower = (bonzoStage || '').toLowerCase().trim();
  // Catch all "new lead" variants first
  if (lower.includes('new lead')) return 'New Lead';

  const stageMap = {
    'aged working': 'Working',
    'working': 'Working',
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
  return stageMap[lower] || 'Working';
};

// Map Bonzo loan purpose
const mapLoanPurpose = (bonzoPurpose) => {
  const lower = (bonzoPurpose || '').toLowerCase();
  if (lower.includes('refi')) return 'Refinance';
  if (lower.includes('purchase')) return 'Purchase';
  return bonzoPurpose || 'Purchase';
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawData = req.body;
    console.log('Bonzo webhook received:', JSON.stringify(rawData, null, 2));

    // Handle nested prospect object from event hooks
    const data = rawData.prospect || rawData.data || rawData;

    // Extract fields from Bonzo payload
    const firstName = data.first_name || data.firstName || '';
    const lastName = data.last_name || data.lastName || '';
    const name = lastName ? `${lastName}, ${firstName}` : firstName;
    const phone = data.phone || data.mobile || '';
    const email = data.email || '';

    if (!name && !phone && !email) {
      return res.status(400).json({ error: 'No identifying info (name, phone, or email)' });
    }

    // Check for existing borrower by phone or email
    let existingBorrower = null;
    if (phone) {
      const { data: byPhone } = await supabase
        .from('borrowers')
        .select('*')
        .ilike('phone', `%${phone.replace(/\D/g, '').slice(-10)}%`)
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

    // Build borrower data from Bonzo fields
    const borrowerData = {
      name: name || existingBorrower?.name,
      phone: phone || existingBorrower?.phone,
      email: email || existingBorrower?.email,
      stage: mapStage(data.stage || data.pipeline_stage),
      loan_purpose: mapLoanPurpose(data.loan_purpose || data.loanPurpose),
      loan_type: data.loan_type || data.loanType || existingBorrower?.loan_type,
      purchase_price: parseFloat(data.purchase_price || data.purchasePrice) || existingBorrower?.purchase_price,
      loan_amount: parseFloat(data.loan_amount || data.loanAmount) || existingBorrower?.loan_amount,
      rate: parseFloat(data.interest_rate || data.rate) || existingBorrower?.rate,
      rate_status: data.rate_is_locked === 'Yes' ? 'Locked' : 'Floating',
      coe_date: data.close_date || data.closeDate || existingBorrower?.coe_date,
      lender: data.lender || existingBorrower?.lender,
      property_address: [
        data.property_address || data.address,
        data.property_city || data.city,
        data.property_state || data.state,
        data.property_zip || data.zip
      ].filter(Boolean).join(', ') || existingBorrower?.property_address,
      occupancy: data.property_use || data.occupancy || existingBorrower?.occupancy,
      bonzo_id: data.lead_id || data.id || data.prospect_id,
      updated_at: new Date().toISOString(),
    };

    // Co-borrower
    if (data.co_borrower_first_name || data.coborrower_name) {
      const coName = data.coborrower_name || `${data.co_borrower_last_name || ''}, ${data.co_borrower_first_name || ''}`.trim();
      if (coName && coName !== ', ') {
        borrowerData.co_borrowers = [coName];
      }
    }

    // Notes from Bonzo
    if (data.notes || data.lead_source) {
      const notePrefix = `[Bonzo ${new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}]`;
      let newNote = '';
      if (data.lead_source) newNote += `Source: ${data.lead_source}. `;
      if (data.notes) newNote += data.notes;
      if (newNote) {
        const existing = existingBorrower?.notes || '';
        borrowerData.notes = existing ? `${notePrefix} ${newNote}\n${existing}` : `${notePrefix} ${newNote}`;
      }
    }

    // Remove undefined/null values
    Object.keys(borrowerData).forEach(k => {
      if (borrowerData[k] === undefined || borrowerData[k] === null || borrowerData[k] === '') {
        delete borrowerData[k];
      }
    });

    let result;
    if (existingBorrower) {
      // Update existing
      const { data: updated, error } = await supabase
        .from('borrowers')
        .update(borrowerData)
        .eq('id', existingBorrower.id)
        .select()
        .single();
      if (error) throw error;
      result = { action: 'updated', borrower: updated };
    } else {
      // Create new - mark as NEW and potentially HOT
      borrowerData.last_touched = new Date().toISOString();
      borrowerData.is_new = true;
      borrowerData.bonzo_created_at = new Date().toISOString();

      // Check if WCL lead
      const isWCL = (data.lead_source || '').toLowerCase().includes('wcl') ||
                    (data.source || '').toLowerCase().includes('wcl') ||
                    (data.lead_source || '').toLowerCase().includes('lead store');

      // All new leads go to "New Lead" stage with yellow highlight + bell
      borrowerData.stage = 'New Lead';
      borrowerData.is_hot_lead = true;
      // Default loan_type so it shows in pipeline (required for filtering)
      if (!borrowerData.loan_type) {
        borrowerData.loan_type = 'DR Purchase';
      }
      // REQUIRED: user_id for RLS - Danielle's account
      borrowerData.user_id = 'c75c0dc8-5bf4-4911-9b48-41c94d2e3494';

      if (isWCL) {
        borrowerData.notes = `🔥 WCL LEAD - CALL IMMEDIATELY!\n${borrowerData.notes || ''}`;
      }

      const { data: created, error } = await supabase
        .from('borrowers')
        .insert([borrowerData])
        .select()
        .single();
      if (error) throw error;
      result = { action: 'created', borrower: created };

      // Store notification for real-time alert
      try {
        await supabase
          .from('notifications')
          .insert([{
            type: 'new_lead',
            title: isWCL ? '🔥 NEW WCL LEAD!' : '📥 New Lead',
            message: `${borrowerData.name} - CALL NOW!`,
            borrower_id: created.id,
            read: false,
          }]);
      } catch (notifErr) {
        console.log('Notification insert skipped:', notifErr.message);
      }
    }

    console.log('Bonzo sync result:', result.action, result.borrower?.name);
    return res.status(200).json({ success: true, ...result });

  } catch (e) {
    console.error('Bonzo webhook error:', e);
    return res.status(500).json({ error: e.message });
  }
}
