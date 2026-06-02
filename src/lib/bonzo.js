import { supabase } from '../lib/supabase';

const BONZO_API_KEY = process.env.REACT_APP_BONZO_API_KEY;
const BONZO_WEBHOOK_URL = process.env.REACT_APP_BONZO_WEBHOOK_URL;

// Stage mapping from Bonzo to CLOSIO
const BONZO_STAGE_MAP = {
  'hot': 'Working',
  'active': 'Working',
  'working': 'Working',
  'shopping': 'Shopping',
  'in escrow': "In Processing",
  'funded': 'Funded',
};

export const bonzoService = {
  // Pull leads from Bonzo
  async pullLeads() {
    if (!BONZO_API_KEY) {
      console.warn('Bonzo API key not configured');
      return { added: 0, updated: 0 };
    }

    try {
      // NOTE: Actual Bonzo API endpoint — configure per your Bonzo account
      const response = await fetch('https://app.bonzo.io/api/v1/prospects', {
        headers: {
          'Authorization': `Bearer ${BONZO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Bonzo API error: ' + response.status);
      const data = await response.json();

      let added = 0;
      let updated = 0;

      for (const lead of (data.prospects || data.data || [])) {
        const closioStage = BONZO_STAGE_MAP[lead.stage?.toLowerCase()] || 'Working';
        
        // Check if borrower already exists (match by name + phone or email)
        const { data: existing } = await supabase
          .from('borrowers')
          .select('id')
          .or(`name.ilike.${lead.first_name} ${lead.last_name},phone.eq.${lead.phone},email.eq.${lead.email}`)
          .single();

        const borrowerData = {
          name: `${lead.first_name} ${lead.last_name}`.trim(),
          phone: lead.phone,
          email: lead.email,
          loan_type: lead.loan_type || null,
          notes: lead.notes || null,
          last_touched: lead.last_contacted_at || new Date().toISOString(),
          bonzo_id: lead.id?.toString(),
          stage: closioStage,
        };

        if (existing) {
          await supabase.from('borrowers').update(borrowerData).eq('id', existing.id);
          updated++;
        } else {
          await supabase.from('borrowers').insert([borrowerData]);
          added++;
        }
      }

      // Log the pull
      await supabase.from('bonzo_pull_log').insert([{
        pulled_at: new Date().toISOString(),
        records_added: added,
        records_updated: updated,
        status: 'success',
      }]);

      return { added, updated };
    } catch (e) {
      console.error('Bonzo pull error:', e);
      await supabase.from('bonzo_pull_log').insert([{
        status: 'error',
        records_added: 0,
        records_updated: 0,
      }]);
      throw e;
    }
  },

  // Push to Bonzo webhook (rate retread trigger)
  async triggerRateRetread(borrower, currentRate, annualSavings) {
    if (!BONZO_WEBHOOK_URL) {
      console.warn('Bonzo webhook URL not configured');
      return;
    }

    try {
      const payload = {
        event: 'rate_retread',
        borrower_name: borrower.name,
        borrower_phone: borrower.phone,
        borrower_email: borrower.email,
        locked_rate: borrower.locked_rate,
        current_rate: currentRate,
        annual_savings: annualSavings,
        triggered_at: new Date().toISOString(),
      };

      await fetch(BONZO_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Mark as triggered in DB
      await supabase
        .from('rate_retread')
        .update({ bonzo_triggered: true, bonzo_triggered_at: new Date().toISOString() })
        .eq('borrower_id', borrower.id);
    } catch (e) {
      console.error('Bonzo webhook error:', e);
      throw e;
    }
  },

  // Push stage change to Bonzo
  async pushStageChange(borrower, newStage) {
    if (!BONZO_WEBHOOK_URL || !borrower.bonzo_id) return;
    try {
      await fetch(BONZO_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'stage_change',
          bonzo_id: borrower.bonzo_id,
          borrower_name: borrower.name,
          new_stage: newStage,
          changed_at: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.error('Bonzo stage push error:', e);
    }
  },

  // Get last pull log
  async getLastPullLog() {
    const { data } = await supabase
      .from('bonzo_pull_log')
      .select('*')
      .order('pulled_at', { ascending: false })
      .limit(1)
      .single();
    return data;
  },
};
