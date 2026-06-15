import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SettingsModal = ({ onClose }) => {
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'bonzo_api_token').single();
        if (data && data.value) setHasToken(true);
      } catch (e) { /* table may not exist yet */ }
    })();
  }, []);

  const save = async () => {
    if (!token.trim()) return;
    setSaving(true);
    setStatus(null);
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'bonzo_api_token', value: token.trim(), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSaving(false);
    if (error) setStatus('❌ ' + error.message);
    else { setStatus('✅ Saved — Bonzo is connected.'); setHasToken(true); setToken(''); }
  };

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const panel = { background: '#15151f', border: '1px solid #3a3a55', borderRadius: '12px', width: 'min(560px, 94vw)', padding: '20px' };
  const label = { fontSize: '11px', color: '#9a9ab8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ color: '#f0f0ff', fontWeight: 800, fontSize: '16px' }}>⚙ Settings</div>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Close</button>
        </div>

        <div style={{ border: '1px solid #3a3a55', borderRadius: '10px', padding: '16px' }}>
          <div style={{ color: '#ec4899', fontWeight: 800, fontSize: '13px', marginBottom: '4px' }}>Bonzo Connection</div>
          <div style={{ color: '#9a9ab8', fontSize: '11px', marginBottom: '12px', lineHeight: 1.5 }}>
            Powers Bonzo Pull, CONVO, and Notes. Status:{' '}
            <span style={{ color: hasToken ? '#22c55e' : '#fbbf24', fontWeight: 700 }}>{hasToken ? 'Connected' : 'Not set'}</span>
          </div>

          <div style={label}>Bonzo API Token</div>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder={hasToken ? 'Paste a new token to replace the current one' : 'Paste your Bonzo API token'}
            style={{ width: '100%', padding: '9px 11px', borderRadius: '6px', border: '1px solid #3a3a55', background: '#0f0f17', color: '#f0f0ff', fontSize: '13px', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: '10px', color: '#6a6a80', margin: '8px 0 12px', lineHeight: 1.5 }}>
            Get it in Bonzo → Settings → Integrations → API → <strong>Add token</strong> (scopes: access-authenticated, prospects, pipelines, conversations, messaging, imports). Saved tokens take effect immediately — no redeploy.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="button" onClick={save} disabled={saving || !token.trim()}
              style={{ background: saving || !token.trim() ? '#475569' : '#ec4899', color: '#fff', border: 'none', borderRadius: '6px', padding: '9px 20px', fontSize: '13px', fontWeight: 800, cursor: saving || !token.trim() ? 'default' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save Token'}
            </button>
            {status && <span style={{ fontSize: '12px', color: status.startsWith('✅') ? '#22c55e' : '#f87171' }}>{status}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
