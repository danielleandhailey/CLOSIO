import React, { useState, useEffect } from 'react';
import { Loader, Zap, RefreshCw } from 'lucide-react';
import { fredService } from '../lib/fred';
import { bonzoService } from '../lib/bonzo';
import { formatCurrency, formatRate } from '../lib/utils';

const RateTreadPage = ({ borrowers }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentRate, setCurrentRate] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [triggering, setTriggering] = useState(new Set());
  const [triggered, setTriggered] = useState(new Set());

  const fundedBorrowers = borrowers.filter(b => b.stage === 'Funded' && b.locked_rate);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await fredService.analyzeRateRetread(fundedBorrowers);
      setResults(res);
      if (res.length > 0) setCurrentRate(res[0].currentRate);
    } catch (e) {
      console.error('Rate retread error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (fundedBorrowers.length > 0) analyze(); }, [fundedBorrowers.length, analyze]);

  const triggerBonzo = async (borrower, currentRate, savings) => {
    setTriggering(s => new Set([...s, borrower.id]));
    try {
      await bonzoService.triggerRateRetread(borrower, currentRate, savings);
      setTriggered(s => new Set([...s, borrower.id]));
    } catch (e) {
      console.error('Bonzo trigger error:', e);
    } finally {
      setTriggering(s => { const n = new Set(s); n.delete(borrower.id); return n; });
    }
  };

  const triggerSelected = async () => {
    const toTrigger = results.filter(r => selected.has(r.borrower.id));
    for (const r of toTrigger) {
      await triggerBonzo(r.borrower, r.currentRate, r.annualSavings);
    }
  };

  const hasEligible = results.some(r => r.shouldTrigger);

  return (
    <div style={{ padding: '16px', flex: 1, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#e8e8f0' }}>📉 Rate Retread Monitor</h2>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {currentRate && (
            <div style={{ fontSize: '12px', color: '#a0a0b8' }}>
              Market: <strong style={{ color: '#9f67f7' }}>{formatRate(currentRate)}</strong>
            </div>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={analyze} disabled={loading}>
            {loading ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
            {loading ? 'Analyzing…' : 'Refresh'}
          </button>
          {selected.size > 0 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={triggerSelected}>
              <Zap size={12} /> Trigger {selected.size} via Bonzo
            </button>
          )}
        </div>
      </div>

      {fundedBorrowers.length === 0 && (
        <div style={{ color: '#6a6a80', textAlign: 'center', padding: '40px', fontSize: '13px' }}>
          No funded borrowers with locked rates yet.<br />
          <span style={{ fontSize: '11px', opacity: 0.7 }}>Add a locked rate to funded borrowers to monitor for savings opportunities.</span>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div style={{ fontSize: '11px', color: '#6a6a80', marginBottom: '8px' }}>
            Ranked by annual savings. Bonzo trigger fires when rate drops 0.25%+ below locked rate.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: '#22222e', borderRadius: '5px 5px 0 0', borderBottom: '1px solid #333345', fontSize: '11px', fontWeight: '600', color: '#6a6a80' }}>
            <input type="checkbox" onChange={e => {
              if (e.target.checked) setSelected(new Set(results.map(r => r.borrower.id)));
              else setSelected(new Set());
            }} />
            <span style={{ width: '120px' }}>Borrower</span>
            <span style={{ width: '80px' }}>Locked Rate</span>
            <span style={{ width: '80px' }}>Market Rate</span>
            <span style={{ width: '70px' }}>Drop</span>
            <span style={{ width: '100px' }}>Annual Savings</span>
            <span style={{ marginLeft: 'auto' }}>Action</span>
          </div>

          {results.map(r => (
            <div key={r.borrower.id} className="retread-row" style={{
              borderLeft: r.shouldTrigger ? '3px solid #16a34a' : '3px solid transparent',
            }}>
              <input
                type="checkbox"
                checked={selected.has(r.borrower.id)}
                onChange={e => {
                  setSelected(s => {
                    const n = new Set(s);
                    e.target.checked ? n.add(r.borrower.id) : n.delete(r.borrower.id);
                    return n;
                  });
                }}
              />
              <span style={{ width: '120px', fontWeight: '600' }}>{r.borrower.name}</span>
              <span style={{ width: '80px', fontFamily: 'Space Mono, monospace', fontSize: '11px' }}>{formatRate(r.lockedRate)}</span>
              <span style={{ width: '80px', fontFamily: 'Space Mono, monospace', fontSize: '11px', color: r.currentRate < r.lockedRate ? '#16a34a' : '#e8e8f0' }}>{formatRate(r.currentRate)}</span>
              <span style={{ width: '70px' }}>
                {r.rateDrop > 0 ? (
                  <span className="rate-drop-badge">▼ {r.rateDrop.toFixed(3)}%</span>
                ) : (
                  <span style={{ fontSize: '10px', color: '#6a6a80' }}>▲ {Math.abs(r.rateDrop).toFixed(3)}%</span>
                )}
              </span>
              <span className="retread-savings" style={{ width: '100px', color: r.annualSavings > 0 ? '#16a34a' : '#dc2626' }}>
                {r.annualSavings > 0 ? '+' : ''}{formatCurrency(r.annualSavings)}/yr
              </span>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                {triggered.has(r.borrower.id) ? (
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600' }}>✅ Triggered</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={triggering.has(r.borrower.id) || !r.shouldTrigger}
                    onClick={() => triggerBonzo(r.borrower, r.currentRate, r.annualSavings)}
                    style={{ opacity: r.shouldTrigger ? 1 : 0.4 }}
                    title={r.shouldTrigger ? 'Trigger Bonzo outreach' : 'Rate not low enough yet (needs 0.25%+ drop)'}
                  >
                    {triggering.has(r.borrower.id) ? <Loader size={10} /> : <Zap size={10} />}
                    Trigger Bonzo
                  </button>
                )}
              </div>
            </div>
          ))}

          {hasEligible && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: '#dcfce780', border: '1px solid #16a34a40', borderRadius: '6px', fontSize: '12px', color: '#14532d' }}>
              ⚡ {results.filter(r => r.shouldTrigger).length} borrower(s) eligible for Bonzo outreach — rate dropped 0.25%+ below lock.
              Bonzo will send SMS + email to borrower and their Realtor automatically.
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default RateTreadPage;
