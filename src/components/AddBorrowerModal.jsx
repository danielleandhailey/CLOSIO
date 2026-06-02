import React, { useState } from 'react';
import { X } from 'lucide-react';
import { STAGES, LENDER_OPTIONS, LOAN_TYPE_OPTIONS } from '../lib/constants';

const AddBorrowerModal = ({ onClose, onSave }) => {
  const [form, setForm] = useState({
    name: '', stage: 'Working', loan_type: 'Conventional',
    lender: '', rate: '', purchase_price: '', loan_amount: '',
    rate_status: 'Floating', coe_date: '', date_submitted: '',
    last_touched: '', notes: '', phone: '', email: '',
    occupancy: 'Primary Residence', income_type: 'W2',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Borrower name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        rate: form.rate ? parseFloat(form.rate) : null,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
        loan_amount: form.loan_amount ? parseFloat(form.loan_amount) : null,
        last_touched: form.last_touched || new Date().toISOString(),
      };
      await onSave(payload);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">
          <span>Add Borrower</span>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: '5px', marginBottom: '12px', fontSize: '12px' }}>
            {error}
          </div>
        )}

        <div className="form-row">
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label>Borrower Name *</label>
            <input className="form-input" type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full Name" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Stage</label>
            <select className="form-input" value={form.stage} onChange={e => set('stage', e.target.value)}>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Loan Type</label>
            <select className="form-input" value={form.loan_type} onChange={e => set('loan_type', e.target.value)}>
              {LOAN_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Lender</label>
            <input className="form-input" type="text" value={form.lender} onChange={e => set('lender', e.target.value)} placeholder="PRMG, Rocket, UWM…" />
          </div>
          <div className="form-field">
            <label>Rate (%)</label>
            <input className="form-input" type="number" step="0.001" value={form.rate} onChange={e => set('rate', e.target.value)} placeholder="6.875" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Purchase Price ($)</label>
            <input className="form-input" type="number" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} placeholder="450000" />
          </div>
          <div className="form-field">
            <label>Loan Amount ($)</label>
            <input className="form-input" type="number" value={form.loan_amount} onChange={e => set('loan_amount', e.target.value)} placeholder="360000" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Rate Status</label>
            <select className="form-input" value={form.rate_status} onChange={e => set('rate_status', e.target.value)}>
              <option value="Floating">Floating</option>
              <option value="Locked">Locked</option>
            </select>
          </div>
          <div className="form-field">
            <label>COE Date</label>
            <input className="form-input" type="date" value={form.coe_date} onChange={e => set('coe_date', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Date Submitted</label>
            <input className="form-input" type="date" value={form.date_submitted} onChange={e => set('date_submitted', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Occupancy</label>
            <select className="form-input" value={form.occupancy} onChange={e => set('occupancy', e.target.value)}>
              <option>Primary Residence</option>
              <option>Second Home</option>
              <option>Investment</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Phone</label>
            <input className="form-input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 555-5555" />
          </div>
          <div className="form-field">
            <label>Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="borrower@email.com" />
          </div>
        </div>

        <div className="form-field" style={{ marginBottom: '16px' }}>
          <label>Notes</label>
          <textarea
            className="notes-area"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Initial notes…"
            style={{ minHeight: '60px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Borrower'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddBorrowerModal;
