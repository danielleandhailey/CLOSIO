import { supabase } from '../lib/supabase';
import { calcAnnualSavings } from './utils';

const FRED_API_KEY = process.env.REACT_APP_FRED_API_KEY;

export const fredService = {
  // Fetch 30-year fixed mortgage rate from FRED
  async getCurrentMortgageRate() {
    if (!FRED_API_KEY) {
      // Return a mock rate for demo
      return 6.875;
    }

    try {
      const res = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&api_key=${FRED_API_KEY}&sort_order=desc&limit=1&file_type=json`
      );
      const data = await res.json();
      const latest = data.observations?.[0];
      return latest ? parseFloat(latest.value) : null;
    } catch (e) {
      console.error('FRED API error:', e);
      return null;
    }
  },

  // Fetch 10-year Treasury rate
  async getTreasuryRate() {
    if (!FRED_API_KEY) return 4.25;

    try {
      const res = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${FRED_API_KEY}&sort_order=desc&limit=1&file_type=json`
      );
      const data = await res.json();
      const latest = data.observations?.[0];
      return latest ? parseFloat(latest.value) : null;
    } catch (e) {
      console.error('FRED Treasury error:', e);
      return null;
    }
  },

  // Run rate retread analysis for all funded borrowers
  async analyzeRateRetread(fundedBorrowers) {
    const currentRate = await this.getCurrentMortgageRate();
    if (!currentRate) return [];

    const results = [];

    for (const b of fundedBorrowers) {
      if (!b.locked_rate) continue;

      const savings = calcAnnualSavings(b.loan_amount, b.locked_rate, currentRate);
      const shouldTrigger = currentRate <= b.locked_rate - 0.25;

      // Upsert rate retread record
      await supabase.from('rate_retread').upsert({
        borrower_id: b.id,
        locked_rate: b.locked_rate,
        current_market_rate: currentRate,
        annual_savings: savings,
        last_checked: new Date().toISOString(),
      }, { onConflict: 'borrower_id' });

      results.push({
        borrower: b,
        lockedRate: b.locked_rate,
        currentRate,
        annualSavings: savings,
        shouldTrigger,
        rateDrop: b.locked_rate - currentRate,
      });
    }

    // Sort by annual savings descending
    return results.sort((a, b) => b.annualSavings - a.annualSavings);
  },
};
