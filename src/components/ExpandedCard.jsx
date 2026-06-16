import React, { useState, useRef, useCallback } from 'react';
import { Plus, X, Check, ChevronDown, ChevronRight, FileText, Upload } from 'lucide-react';
import { STAGES_WITH_FULL_DETAILS, CONTACT_ROLES, STIP_TEMPLATES, STIP_CATEGORIES, EMPLOYMENT_TYPES, INCOME_TYPES } from '../lib/constants';
import { formatDate, formatCurrency, formatRate, calcPI, calcLTV, taskUrgency, urgencyColor } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { claudeService } from '../lib/claude';
import CommunicationPanel from './CommunicationPanel';
import { format, parseISO, addDays } from 'date-fns';

// ---- Notes Section ----
const NotesSection = ({ borrower, ops, onClose }) => {
  const [newNote, setNewNote] = useState('');

  // Parse notes from borrower.notes field (each line is a dated note)
  const noteLines = (borrower.notes || '').split('\n').filter(line => line.trim());

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    await ops.addNote(borrower.id, newNote.trim());
    setNewNote('');
  };

  // Save the notes list back, splitting on the current field so we never clobber.
  const saveLines = async (lines) => {
    await ops.updateBorrower(borrower.id, { notes: lines.join('\n') });
  };
  const deleteLine = async (target) => {
    const lines = (borrower.notes || '').split('\n').filter(l => l.trim());
    await saveLines(lines.filter(l => l !== target));
  };
  // Toggle the red priority flag on a single note (add/remove its 🚩 marker)
  const toggleFlag = async (target) => {
    const lines = (borrower.notes || '').split('\n').filter(l => l.trim());
    const updated = lines.map(l => {
      if (l !== target) return l;
      const m = l.match(/^(\[\d{1,2}\/\d{1,2}\/\d{2}\]\s*)([\s\S]*)$/);
      if (!m) return l.trim().startsWith('🚩') ? l.replace(/^\s*🚩\s*/, '') : `🚩 ${l}`;
      const body = m[2];
      const nb = body.trim().startsWith('🚩') ? body.replace(/^\s*🚩\s*/, '') : `🚩 ${body}`;
      return `${m[1]}${nb}`;
    });
    await saveLines(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input
          type="text"
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="Add a note..."
          style={{ flex: 1, padding: '8px 12px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px' }}
        />
        <button
          type="button"
          onClick={handleAdd}
          style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '5px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }}
        >+ Add</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: '#0f172a', borderRadius: '6px', padding: '12px' }}>
        {noteLines.length > 0 ? noteLines.map((line, i) => {
          const match = line.match(/^\[(\d{1,2}\/\d{1,2}\/\d{2})\]\s*([\s\S]*)$/);
          const dateStr = match ? match[1] : '';
          const rawText = match ? match[2] : line;
          const isPriority = rawText.trim().startsWith('🚩');
          const noteText = isPriority ? rawText.replace(/^\s*🚩\s*/, '') : rawText;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px', paddingBottom: '10px', borderBottom: i < noteLines.length - 1 ? '1px solid #334155' : 'none' }}>
              <div style={{ flex: 1 }}>
                {dateStr && (
                  <div style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '600', marginBottom: '4px' }}>{dateStr}</div>
                )}
                <div style={{ fontSize: '14px', color: isPriority ? '#f87171' : '#fff', fontWeight: isPriority ? 700 : 400, lineHeight: 1.5 }}>{noteText}</div>
              </div>
              <button
                type="button"
                onClick={() => toggleFlag(line)}
                title={isPriority ? 'Un-flag (remove red)' : 'Flag as priority (red)'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', lineHeight: 1, filter: isPriority ? 'none' : 'grayscale(1)', opacity: isPriority ? 1 : 0.45, flexShrink: 0 }}
              >🚩</button>
              <button
                type="button"
                onClick={() => deleteLine(line)}
                title="Delete note"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', flexShrink: 0, padding: 0 }}
              ><X size={15} /></button>
            </div>
          );
        }) : (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>No notes yet</div>
        )}
      </div>
    </div>
  );
};

// ---- Tasks Section ----
const TasksSection = ({ borrower, ops }) => {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', due_date: '', due_time: '', type: 'task', assigned_to: 'Danielle' });
  const [customAssign, setCustomAssign] = useState('');

  const tasks = (borrower.tasks || []).sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  });

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    // Appointments require time
    if (form.type === 'appointment' && !form.due_time) {
      alert('Appointments require a time');
      return;
    }
    try {
      const assignee = form.assigned_to === 'Other' ? customAssign : form.assigned_to;
      // Combine date+time into single due_date field (don't send due_time separately)
      let dueDateTime = null;
      if (form.due_date) {
        dueDateTime = form.due_time ? `${form.due_date}T${form.due_time}` : form.due_date;
      }
      await ops.addTask({
        title: form.title,
        due_date: dueDateTime,
        type: form.type,
        assigned_to: assignee,
        borrower_id: borrower.id
      });
      setForm({ title: '', due_date: '', due_time: '', type: 'task', assigned_to: 'Danielle' });
      setCustomAssign('');
      setAdding(false);
    } catch (e) {
      console.error('Save task error:', e);
      alert('Failed to save task: ' + e.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>✅ TASKS & APPOINTMENTS</span>
        <button type="button" onClick={() => setAdding(a => !a)}
          style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
          + Add
        </button>
      </div>

      {tasks.map(task => {
        const isCompleted = task.completed;
        const isAppt = task.type === 'appointment';

        return (
          <div key={task.id} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 10px', marginBottom: '4px', borderRadius: '6px',
            background: isCompleted ? '#f1f5f9' : (isAppt ? '#dbeafe' : '#fff'),
            border: `1px solid ${isCompleted ? '#cbd5e1' : (isAppt ? '#3b82f6' : '#e2e8f0')}`,
          }}>
            <button
              type="button"
              onClick={() => ops.updateTask(task.id, { completed: !isCompleted })}
              style={{
                width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                background: isCompleted ? '#22c55e' : '#fff',
                border: `2px solid ${isCompleted ? '#22c55e' : '#cbd5e1'}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '11px', fontWeight: '700',
              }}
            >
              {isCompleted ? '✓' : ''}
            </button>
            <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '3px', background: isAppt ? '#3b82f6' : '#22c55e', color: '#fff', flexShrink: 0 }}>
              {isAppt ? 'APPT' : 'TASK'}
            </span>
            <span style={{ flex: 1, fontSize: '12px', color: isCompleted ? '#94a3b8' : '#1e293b', textDecoration: isCompleted ? 'line-through' : 'none' }}>
              {task.title}
            </span>
            {task.due_date && (
              <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                {(() => {
                  try {
                    const d = typeof task.due_date === 'string' ? parseISO(task.due_date) : task.due_date;
                    if (isNaN(d.getTime())) return '';
                    const hasTime = typeof task.due_date === 'string' && task.due_date.includes('T');
                    return hasTime ? format(d, 'M/d/yy h:mma') : format(d, 'M/d/yy');
                  } catch (e) { return ''; }
                })()}
              </span>
            )}
            {task.assigned_to && <span style={{ fontSize: '10px', color: '#94a3b8' }}>{task.assigned_to}</span>}
            <button type="button" onClick={() => ops.deleteTask(task.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '14px', padding: '2px' }}>
              ×
            </button>
          </div>
        );
      })}

      {adding && (
        <div style={{ background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '6px', padding: '12px', marginTop: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '6px 8px', borderRadius: '4px', fontSize: '12px' }}
            >
              <option value="task">Task</option>
              <option value="appointment">Appointment</option>
            </select>
            <input
              type="date"
              value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '6px 8px', borderRadius: '4px', fontSize: '12px' }}
            />
            <input
              type="time"
              value={form.due_time}
              onChange={e => setForm(f => ({ ...f, due_time: e.target.value }))}
              placeholder="Time"
              style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '6px 8px', borderRadius: '4px', fontSize: '12px' }}
            />
          </div>
          <input
            type="text"
            placeholder="Title / description…"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{ width: '100%', background: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '8px', borderRadius: '4px', fontSize: '12px', marginBottom: '6px', outline: 'none' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <select
              value={form.assigned_to}
              onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
              style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '8px', borderRadius: '4px', fontSize: '12px' }}
            >
              <option value="Danielle">Danielle</option>
              <option value="Hailey">Hailey</option>
              <option value="Both">Both</option>
              <option value="Other">Other...</option>
            </select>
            {form.assigned_to === 'Other' && (
              <input
                type="text"
                placeholder="Enter name..."
                value={customAssign}
                onChange={e => setCustomAssign(e.target.value)}
                style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '8px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
              />
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAdd(); }}
              style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
              Save
            </button>
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAdding(false); }}
              style={{ background: '#e2e8f0', color: '#475569', border: 'none', padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Convert a File to base64 (strips the data: prefix)
const fileToBase64 = (file) => new Promise((res, rej) => {
  const reader = new FileReader();
  reader.onload = ev => res(ev.target.result.split(',')[1]);
  reader.onerror = rej;
  reader.readAsDataURL(file);
});

// The documents table has been seen as both 'documents' and 'Documents' — try
// both so saves/reads work regardless of how the table was created.
const fetchDocuments = async (borrowerId) => {
  for (const t of ['documents', 'Documents']) {
    const { data, error } = await supabase.from(t)
      .select('*').eq('borrower_id', borrowerId).order('created_at', { ascending: false });
    if (!error) return data || [];
  }
  return [];
};
const insertDocument = async (record) => {
  const errs = [];
  for (const t of ['documents', 'Documents']) {
    const { error } = await supabase.from(t).insert([record]);
    if (!error) return null;
    errs.push(error.message);
  }
  // prefer the real reason (e.g. permission) over a "relation does not exist"
  return errs.find(m => !/exist|relation/i.test(m)) || errs[0];
};

// Do two borrower names share any name word? Used to catch wrong-file doc drops.
const sameBorrower = (a, b) => {
  const tokens = (n) => (n || '').toLowerCase().match(/[a-z]{2,}/g) || [];
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return true; // can't tell — don't block
  return ta.some(t => tb.includes(t));
};

// Rebuild a Blob from stored base64 (for re-uploading a queued file to storage)
const base64ToBlob = (b64, mime) => {
  const bytes = atob(b64 || '');
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime || 'application/pdf' });
};

// Build a credit_report scores object from AI-extracted fields (FICO + optional VantageScore)
const buildCreditScores = (extracted) => {
  const fico = {};
  if (extracted.fico_equifax) fico.equifax = extracted.fico_equifax;
  if (extracted.fico_experian) fico.experian = extracted.fico_experian;
  if (extracted.fico_transunion) fico.transunion = extracted.fico_transunion;
  const vantage = {};
  if (extracted.vantage_equifax) vantage.equifax = extracted.vantage_equifax;
  if (extracted.vantage_experian) vantage.experian = extracted.vantage_experian;
  if (extracted.vantage_transunion) vantage.transunion = extracted.vantage_transunion;
  const out = {};
  if (Object.keys(fico).length) out.scores = fico;
  if (Object.keys(vantage).length) out.vantage_scores = vantage;
  if (extracted.negative_marks != null) out.negative_marks = extracted.negative_marks;
  if (extracted.public_records != null) out.public_records = extracted.public_records;
  return out;
};

// ---- Underwriter qualifying-income calc (W-2 / paystub first) ----
const PERIODS_PER_YEAR = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, annual: 1, annually: 1, yearly: 1 };

const ytdMonthsElapsed = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.getMonth() + (d.getDate() / 30.44); // months from Jan 1 through the pay date
};

// Returns { monthly, method } — qualifying monthly income for one income entry
const calcMonthlyIncome = (inc) => {
  const freqKey = (inc.pay_frequency || '').toLowerCase().replace(/[\s-]/g, '');
  const ppy = PERIODS_PER_YEAR[freqKey];
  const cat = (inc.category || inc.income_type || '').toLowerCase();
  const isVariable = /overtime|bonus|commission|variable/.test(cat);
  const ytdMonths = ytdMonthsElapsed(inc.ytd_as_of_date);

  if (isVariable && inc.ytd_gross && ytdMonths) {
    return { monthly: inc.ytd_gross / ytdMonths, method: 'YTD average' };
  }
  if (inc.amount_per_period && ppy) {
    return { monthly: (inc.amount_per_period * ppy) / 12, method: `${inc.pay_frequency} base` };
  }
  if (inc.hourly_rate && inc.hours_per_period && ppy) {
    return { monthly: (inc.hourly_rate * inc.hours_per_period * ppy) / 12, method: 'hourly base' };
  }
  if (inc.gross_monthly) {
    return { monthly: Number(inc.gross_monthly), method: 'stated monthly' };
  }
  if (inc.ytd_gross && ytdMonths) {
    return { monthly: inc.ytd_gross / ytdMonths, method: 'YTD average' };
  }
  return { monthly: 0, method: 'n/a' };
};

// Mortgage mid score: middle of 3, lower of 2, the one of 1
const midScore = (scoreObj) => {
  const vals = Object.values(scoreObj || {}).filter(Boolean).sort((a, b) => a - b);
  if (!vals.length) return null;
  return vals[Math.floor((vals.length - 1) / 2)];
};

// Update the borrower, but if the DB rejects an unknown column, retry field-by-field
// so one bad/missing column never blocks the rest from saving.
const safeUpdateBorrower = async (borrowerId, updates) => {
  if (!updates || Object.keys(updates).length === 0) return;
  const { error } = await supabase.from('borrowers').update(updates).eq('id', borrowerId);
  if (!error) return;
  console.warn('Batch borrower update failed, retrying per-field:', error.message);
  for (const [key, val] of Object.entries(updates)) {
    const { error: e2 } = await supabase.from('borrowers').update({ [key]: val }).eq('id', borrowerId);
    if (e2) console.warn(`Skipped field "${key}":`, e2.message);
  }
};

// Central populate: write everything the AI extracted onto the borrower + contacts/contingencies/incomes.
// Shared by every drop zone so they all behave identically.
const applyExtractedData = async (borrower, extracted, ops) => {
  if (!extracted || Object.keys(extracted).length === 0) return;
  const updates = {};

  // Borrowers
  if (extracted.borrower_name) updates.name = extracted.borrower_name;
  if (Array.isArray(extracted.co_borrowers) && extracted.co_borrowers.length) {
    updates.co_borrowers = extracted.co_borrowers;
    updates.co_borrower = extracted.co_borrowers[0];
  }
  if (extracted.non_borrowing_spouse) updates.non_borrowing_spouse = extracted.non_borrowing_spouse;

  // Loan terms / Sub Hub underlying fields
  if (extracted.purchase_price) updates.purchase_price = extracted.purchase_price;
  if (extracted.loan_amount) updates.loan_amount = extracted.loan_amount;
  if (extracted.loan_type) updates.loan_type = extracted.loan_type;
  if (extracted.loan_purpose) updates.loan_purpose = extracted.loan_purpose;
  if (extracted.rate) updates.rate = extracted.rate;
  if (extracted.apr) updates.apr = extracted.apr;
  if (extracted.coe_date) updates.coe_date = extracted.coe_date;
  if (extracted.dti) updates.dti = extracted.dti;
  if (extracted.ltv) updates.ltv = extracted.ltv;
  if (extracted.earnest_money) updates.earnest_money = extracted.earnest_money;
  if (extracted.seller_cc) updates.seller_cc = extracted.seller_cc;
  if (extracted.property_type) updates.property_type = extracted.property_type;
  if (extracted.property_address) updates.property_address = extracted.property_address;
  if (extracted.occupancy) updates.occupancy = extracted.occupancy;
  if (extracted.wholesale_loan_number) updates.wholesale_loan_number = extracted.wholesale_loan_number;

  // Appraisal
  if (extracted.appraisal_value) updates.appraisal_value = extracted.appraisal_value;
  if (extracted.appraisal_type) updates.appraisal_type = extracted.appraisal_type;
  if (extracted.appraisal_subject_to) updates.appraisal_subject_to = extracted.appraisal_subject_to;
  if (extracted.appraisal_reinspection !== undefined) updates.appraisal_reinspection = extracted.appraisal_reinspection;

  // Credit report (FICO + optional VantageScore)
  if (extracted.credit_auth_date) updates.credit_auth_date = extracted.credit_auth_date;
  const creditScores = buildCreditScores(extracted);
  if (Object.keys(creditScores).length) {
    updates.credit_report = { ...(borrower.credit_report || {}), ...creditScores };
    const mid = extracted.credit_score_mid || midScore(creditScores.scores) || midScore(creditScores.vantage_scores);
    if (mid) updates.credit_score_mid = mid;
  } else if (extracted.credit_score_mid) {
    updates.credit_score_mid = extracted.credit_score_mid;
  }

  // Date-gate: each field carries an "as of" date. A document value only wins if
  // the document's own date is newer-or-equal to the date stored for that field.
  // (Manual entries are stamped "today" in updateBorrower, so older docs can't clobber them.)
  if (Object.keys(updates).length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const raw = (extracted.document_date || '').slice(0, 10);
    const docDate = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
    const fieldDates = borrower.field_dates || {};
    const gated = {};
    const newDates = {};
    for (const [k, v] of Object.entries(updates)) {
      const prev = fieldDates[k];
      if (!prev || docDate >= prev) {
        gated[k] = v;
        newDates[k] = docDate;
      }
    }
    if (Object.keys(gated).length > 0) {
      gated.field_dates = { ...fieldDates, ...newDates };
      await safeUpdateBorrower(borrower.id, gated);
    }
  }

  // Contacts
  if (extracted.buyer_agent_name) {
    await ops.upsertContact(borrower.id, 'buyers_agent', {
      name: extracted.buyer_agent_name,
      phone: extracted.buyer_agent_phone || '',
      email: extracted.buyer_agent_email || '',
      company: extracted.buyer_agent_company || '',
    });
  }
  if (extracted.listing_agent_name) {
    await ops.upsertContact(borrower.id, 'listing_agent', {
      name: extracted.listing_agent_name,
      phone: extracted.listing_agent_phone || '',
      email: extracted.listing_agent_email || '',
      company: extracted.listing_agent_company || '',
    });
  }
  if (extracted.title_company) {
    await ops.upsertContact(borrower.id, 'title_escrow', {
      company: extracted.title_company,
      phone: extracted.title_company_phone || '',
      email: extracted.title_company_email || '',
    });
  }
  if (extracted.lender_ae_name) {
    await ops.upsertContact(borrower.id, 'lender_ae', {
      name: extracted.lender_ae_name,
      phone: extracted.lender_ae_phone || '',
      email: extracted.lender_ae_email || '',
      company: extracted.lender_ae_company || '',
    });
  }
  if (extracted.underwriter_name) {
    await ops.upsertContact(borrower.id, 'underwriter', {
      name: extracted.underwriter_name,
      phone: extracted.underwriter_phone || '',
      email: extracted.underwriter_email || '',
    });
  }

  // Contingencies
  if (Array.isArray(extracted.contingencies)) {
    for (const c of extracted.contingencies) {
      const flagPrefix = c.fully_executed === false ? '🚩 ' : '';
      await ops.addContingency(borrower.id, flagPrefix + c.name, c.due_date || null);
    }
  }

  // Incomes (resilient — won't hard-fail if the column is missing)
  if (Array.isArray(extracted.incomes) && extracted.incomes.length) {
    const existingIncomes = borrower.incomes || [];
    const newIncomes = extracted.incomes.map((inc, idx) => ({ ...inc, id: `${Date.now()}_${idx}` }));
    await safeUpdateBorrower(borrower.id, { incomes: [...existingIncomes, ...newIncomes] });
  }
};

// ---- Document Drop Zone ----
const DocDropZone = ({ borrower, onDocAdded, ops, label, compact }) => {
  const [dragging, setDragging] = useState(false);
  const [queueRows, setQueueRows] = useState([]); // persisted doc_queue rows (survives refresh)
  const [processing, setProcessing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [docs, setDocs] = useState([]);
  const [docSaveError, setDocSaveError] = useState(null);
  const [showDocs, setShowDocs] = useState(!compact);
  const inputRef = useRef();
  const pausedRef = useRef(false);
  const runningRef = useRef(false);

  const loadDocs = useCallback(async () => {
    setDocs(await fetchDocuments(borrower.id));
  }, [borrower.id]);

  // Load the queue list (without the heavy base64 `data` column)
  const loadQueue = useCallback(async () => {
    const { data } = await supabase.from('doc_queue')
      .select('id, file_name, mime_type, status, summary, field_count, error, created_at')
      .eq('borrower_id', borrower.id).order('created_at', { ascending: true });
    setQueueRows(data || []);
    return data || [];
  }, [borrower.id]);

  React.useEffect(() => {
    loadDocs();
    // Recover any doc left mid-read by an interrupted session, then show the queue
    supabase.from('doc_queue').update({ status: 'waiting' })
      .eq('borrower_id', borrower.id).eq('status', 'reading')
      .then(() => loadQueue());
  }, [loadDocs, loadQueue, borrower.id]);

  // Drop files -> persist each to the doc_queue table (survives refresh), then start.
  const addFilesToQueue = async (files) => {
    const newFiles = Array.from(files).filter(f =>
      f.type === 'application/pdf' || f.type.startsWith('image/')
    );
    for (const f of newFiles) {
      try {
        const base64 = await fileToBase64(f);
        await supabase.from('doc_queue').insert([{
          borrower_id: borrower.id,
          file_name: f.name,
          mime_type: f.type || 'application/pdf',
          data: base64,
          status: 'waiting',
        }]);
      } catch (e) {
        console.error('Queue insert failed for', f.name, e);
      }
    }
    await loadQueue();
    runProcessor();
  };

  const removeQueueRow = async (id) => {
    await supabase.from('doc_queue').delete().eq('id', id);
    await loadQueue();
  };

  const retryQueueRow = async (id) => {
    await supabase.from('doc_queue').update({ status: 'waiting', error: null }).eq('id', id);
    await loadQueue();
    runProcessor();
  };

  const pauseProcessing = () => { pausedRef.current = true; setPaused(true); };
  const resumeProcessing = () => { runProcessor(); };

  // Process waiting docs one at a time. Re-reads the queue table each loop so it
  // resumes correctly after a refresh / from another session. Stops when paused or empty.
  const runProcessor = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    pausedRef.current = false;
    setPaused(false);
    setProcessing(true);

    try {
      // Recover any row stuck mid-read (e.g. from a prior interrupted run)
      await supabase.from('doc_queue').update({ status: 'waiting' })
        .eq('borrower_id', borrower.id).eq('status', 'reading');

      while (!pausedRef.current) {
        const { data: rows } = await supabase.from('doc_queue')
          .select('*').eq('borrower_id', borrower.id).eq('status', 'waiting')
          .order('created_at', { ascending: true }).limit(1);
        const row = rows && rows[0];
        if (!row) break;

        await supabase.from('doc_queue').update({ status: 'reading' }).eq('id', row.id);
        await loadQueue();

        let aiSummary = '';
        let extracted = {};
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const result = await claudeService.analyzeDocument(row.data, row.mime_type, row.file_name);
            aiSummary = result.summary || '';
            extracted = result.extracted || {};
          } catch (e) {
            aiSummary = 'AI analysis unavailable';
          }
          if (/rate limit|exceed your organization|429/i.test(aiSummary) && attempt < 2) {
            await supabase.from('doc_queue').update({ summary: 'Rate limit — waiting 60s, will retry…' }).eq('id', row.id);
            await loadQueue();
            await new Promise(r => setTimeout(r, 60000));
            if (pausedRef.current) break;
            continue;
          }
          break;
        }

        const errored = aiSummary.startsWith('Error') || aiSummary === 'AI analysis unavailable';
        if (errored) {
          await supabase.from('doc_queue').update({ status: 'error', error: aiSummary }).eq('id', row.id);
          await loadQueue();
          continue;
        }

        // If the doc is clearly for a different borrower, ask before applying anything
        if (extracted.borrower_name && borrower.name && !sameBorrower(extracted.borrower_name, borrower.name)) {
          const apply = window.confirm(
            `This document looks like it's for "${extracted.borrower_name}", but this file is "${borrower.name}".\n\nOK = add it to THIS file anyway.\nCancel = skip this document.`
          );
          if (!apply) {
            await supabase.from('doc_queue').delete().eq('id', row.id);
            await loadQueue();
            continue;
          }
        }

        // Save a Documents record (best-effort storage upload so the link works)
        let filePath = '';
        try {
          const blob = base64ToBlob(row.data, row.mime_type);
          const path = `${borrower.id}/${Date.now()}_${row.file_name}`;
          const { error: upErr } = await supabase.storage.from('Documents').upload(path, blob);
          if (!upErr) {
            const { data: urlData } = supabase.storage.from('Documents').getPublicUrl(path);
            filePath = urlData.publicUrl;
          }
        } catch (e) { /* storage not configured */ }

        const docErr = await insertDocument({
          borrower_id: borrower.id, name: row.file_name,
          file_path: filePath || row.file_name, file_type: row.mime_type,
          ai_summary: aiSummary,
        });
        if (docErr) { console.error('documents insert failed:', docErr); setDocSaveError(docErr); }
        else setDocSaveError(null);

        await applyExtractedData(borrower, extracted, ops);

        // Done -> remove from the queue to keep it lean
        await supabase.from('doc_queue').delete().eq('id', row.id);
        await loadQueue();
        loadDocs();
        if (onDocAdded) onDocAdded();
      }
    } finally {
      runningRef.current = false;
      setProcessing(false);
      setShowDocs(true);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFilesToQueue(e.dataTransfer.files);
  };

  const statusColor = (s) => s === 'reading' ? '#b07eff' : s === 'error' ? '#f87171' : s === 'done' ? '#22c55e' : '#fbbf24';
  const statusLabel = (s) => s === 'reading' ? '🤖 Reading…' : s === 'error' ? '❌ Error' : s === 'done' ? '✅ Done' : '⏳ Waiting';
  const waitingCount = queueRows.filter(r => r.status === 'waiting').length;

  return (
    <div>
      <div className="section-heading">
        {label || '📎 Documents'}
        {!compact && (
          <button type="button" className="btn-xs btn-ghost" onClick={() => setShowDocs(s => !s)} style={{ marginLeft: 'auto' }}>
            {showDocs ? 'Hide' : `Show saved (${docs.length})`}
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        className={`doc-zone ${dragging ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={22} style={{ marginBottom: '8px', opacity: 0.6 }} />
        <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '13px' }}>Drop documents here or click to browse</div>
        <div style={{ fontSize: '11px', opacity: 0.7 }}>Purchase Agreements · Counter Offers · Appraisals · AUS · Pay Stubs · Bank Statements · Tax Returns</div>
        <div style={{ fontSize: '11px', color: '#b07eff', marginTop: '6px', fontWeight: '600' }}>🤖 AI extracts key data automatically — drop as many as you need</div>
      </div>

      <input ref={inputRef} type="file" accept=".pdf,image/*" multiple style={{ display: 'none' }}
        onChange={e => { addFilesToQueue(e.target.files); e.target.value = ''; }} />

      {/* Persistent document queue — survives refresh; pause / resume / delete / retry */}
      {queueRows.length > 0 && (
        <div style={{ background: '#1e1e2a', border: '1px solid #3a3a55', borderRadius: '8px', padding: '12px', marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#f0f0ff' }}>
              📋 Document queue ({queueRows.length})
            </div>
            <div style={{ marginLeft: 'auto' }}>
              {processing ? (
                <button type="button" onClick={pauseProcessing}
                  style={{ padding: '4px 12px', borderRadius: '5px', background: '#fbbf24', color: '#000', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>
                  ⏸ Pause
                </button>
              ) : waitingCount > 0 ? (
                <button type="button" onClick={resumeProcessing}
                  style={{ padding: '4px 12px', borderRadius: '5px', background: '#8b4cf7', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>
                  ▶ {paused ? 'Resume' : 'Process'} ({waitingCount})
                </button>
              ) : null}
            </div>
          </div>
          {queueRows.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #3a3a55', fontSize: '12px' }}>
              <FileText size={13} style={{ color: '#93c5fd', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#b8b8d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.file_name}</div>
                {r.status === 'error' && r.error && <div style={{ color: '#f87171', fontSize: '10px' }}>{r.error}</div>}
                {r.status === 'reading' && r.summary && <div style={{ color: '#fbbf24', fontSize: '10px' }}>{r.summary}</div>}
              </div>
              <span style={{ color: statusColor(r.status), fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>{statusLabel(r.status)}</span>
              {r.status === 'error' && (
                <button type="button" onClick={() => retryQueueRow(r.id)} title="Retry"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: '13px', flexShrink: 0 }}>↻</button>
              )}
              <button type="button" onClick={() => removeQueueRow(r.id)} title="Remove from queue"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Saved docs list with delete */}
      {showDocs && (
        <div style={{ background: '#1e1e2a', border: '1px solid #3a3a55', borderRadius: '8px', padding: '10px', marginTop: '10px' }}>
          {docSaveError && <div style={{ color: '#f87171', fontSize: '11px', marginBottom: '6px' }}>⚠️ Couldn't save to document list: {docSaveError}</div>}
          {docs.length === 0 && !docSaveError && <div style={{ color: '#8080a8', fontSize: '12px' }}>No documents saved yet.</div>}
          {docs.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid #3a3a55', fontSize: '12px' }}>
              <FileText size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
              <a href={doc.file_path} target="_blank" rel="noopener noreferrer" title={doc.ai_summary || doc.name}
                style={{ flex: 1, color: '#60a5fa', textDecoration: 'none', fontWeight: '600', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.name}
              </a>
              <span style={{ color: '#8080a8', flexShrink: 0, fontSize: '10px', fontFamily: 'monospace' }}>{formatDate(doc.created_at)}</span>
              <button type="button" onClick={async () => {
                if (!window.confirm(`Delete "${doc.name}"?`)) return;
                await supabase.from('documents').delete().eq('id', doc.id);
                loadDocs();
              }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px', flexShrink: 0 }} title="Delete">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---- Document Storage (all docs with delete) ----
const DocumentStorage = ({ borrower }) => {
  const [docs, setDocs] = useState([]);

  const loadDocs = useCallback(async () => {
    setDocs(await fetchDocuments(borrower.id));
  }, [borrower.id]);

  React.useEffect(() => { loadDocs(); }, [loadDocs]);

  const deleteDoc = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}"?`)) return;
    await supabase.from('documents').delete().eq('id', doc.id);
    if (doc.file_path && doc.file_path.includes('supabase')) {
      const path = doc.file_path.split('/documents/')[1];
      if (path) await supabase.storage.from('Documents').remove([path]);
    }
    loadDocs();
  };

  return (
    <div>
      {docs.length === 0 && <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No documents uploaded yet.</div>}
      {docs.map(doc => (
        <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '6px' }}>
          <FileText size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <a href={doc.file_path} target="_blank" rel="noopener noreferrer" style={{ color: '#0d9488', textDecoration: 'none', fontWeight: '600', fontSize: '12px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc.name}
            </a>
            <div style={{ fontSize: '10px', color: '#64748b' }}>{formatDate(doc.created_at)} · {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : ''}</div>
          </div>
          <button type="button" onClick={() => deleteDoc(doc)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '4px' }} title="Delete">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

// ---- Stage History ----
const StageHistory = ({ borrowerId }) => {
  const [history, setHistory] = useState([]);

  React.useEffect(() => {
    supabase.from('stage_history').select('*').eq('borrower_id', borrowerId)
      .order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setHistory(data || []));
  }, [borrowerId]);

  return (
    <div>
      <div className="section-heading">📋 Stage History</div>
      {history.length === 0 && <div style={{ color: '#6a6a80', fontSize: '12px' }}>No stage changes yet</div>}
      {history.map(h => (
        <div key={h.id} className="history-item">
          <span style={{ color: '#6a6a80', fontFamily: 'Space Mono, monospace', fontSize: '10px', flexShrink: 0 }}>
            {formatDate(h.created_at)}
          </span>
          <span>{h.from_stage || '—'} → <strong>{h.to_stage}</strong></span>
        </div>
      ))}
    </div>
  );
};

// ---- Contingencies (for Processing, Funded, LP Ready, Paycom) ----
const ContingenciesSection = ({ borrower, ops }) => {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');

  const contingencies = borrower.contingencies || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <button type="button" className="btn-xs btn-ghost" onClick={() => setAdding(a => !a)}>
          <Plus size={10} /> Add
        </button>
      </div>

      {contingencies.map(c => (
        <div key={c.id} className="contingency-item">
          <input type="checkbox" checked={c.completed} onChange={() => ops.toggleContingency(c.id, !c.completed)} />
          <span style={{ flex: 1, fontSize: '13px', fontWeight: '500', textDecoration: c.completed ? 'line-through' : 'none', color: c.completed ? '#94a3b8' : '#1e293b' }}>
            {c.name}
          </span>
          {c.due_date && (
            <span className="contingency-date">{formatDate(c.due_date)}</span>
          )}
          <button type="button" onClick={() => ops.removeContingency(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
            <X size={12} />
          </button>
        </div>
      ))}

      {adding && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Contingency name…"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ flex: 1, background: '#1a1a23', border: '1px solid #333345', color: '#e8e8f0', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
          />
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            style={{ background: '#1a1a23', border: '1px solid #333345', color: '#e8e8f0', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => {
            if (name.trim()) { ops.addContingency(borrower.id, name.trim(), dueDate || null); setName(''); setDueDate(''); setAdding(false); }
          }}>Add</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>×</button>
        </div>
      )}
    </div>
  );
};

// ---- Contact Accordion ----
// ---- Contacts Card (all contacts on one clean card) ----
const ContactsCard = ({ borrower, ops }) => {
  const contacts = borrower.contacts || [];
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const startEdit = (role) => {
    const contact = contacts.find(c => c.role === role) || {};
    setForm({ name: contact.name || '', company: contact.company || '', address: contact.address || '', phone: contact.phone || '', email: contact.email || '' });
    setEditing(role);
  };

  const saveEdit = async () => {
    await ops.upsertContact(borrower.id, editing, form);
    setEditing(null);
  };

  const cardStyle = { background: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', color: '#1e293b' };
  const sectionStyle = { marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' };
  const labelStyle = { fontSize: '10px', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' };
  const valueStyle = { fontSize: '13px', color: '#1e293b', fontWeight: '500' };

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: '#0d9488', borderBottom: '2px solid #0d9488', paddingBottom: '8px' }}>
        Contact Information
      </div>
      {CONTACT_ROLES.map(r => {
        const contact = contacts.find(c => c.role === r.value) || {};
        const hasData = contact.name || contact.company;
        if (editing === r.value) {
          return (
            <div key={r.value} style={sectionStyle}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>{r.label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {['name', 'company', 'phone', 'email'].map(k => (
                  <div key={k}>
                    <div style={labelStyle}>{k}</div>
                    <input type="text" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
                  </div>
                ))}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={labelStyle}>address</div>
                  <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={saveEdit} style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Save</button>
                <button onClick={() => setEditing(null)} style={{ background: '#e2e8f0', color: '#475569', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          );
        }
        return (
          <div key={r.value} style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>{r.label}</div>
              <button onClick={() => startEdit(r.value)} style={{ background: 'none', border: 'none', color: '#0d9488', fontSize: '11px', cursor: 'pointer' }}>Edit</button>
            </div>
            {hasData ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginTop: '6px' }}>
                {contact.name && <div><div style={labelStyle}>Name</div><div style={valueStyle}>{contact.name}</div></div>}
                {contact.company && <div><div style={labelStyle}>Company</div><div style={valueStyle}>{contact.company}</div></div>}
                {contact.phone && <div><div style={labelStyle}>Phone</div><div style={valueStyle}>{contact.phone}</div></div>}
                {contact.email && <div><div style={labelStyle}>Email</div><div style={valueStyle}>{contact.email}</div></div>}
                {contact.address && <div style={{ gridColumn: '1 / -1' }}><div style={labelStyle}>Address</div><div style={valueStyle}>{contact.address}</div></div>}
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>No contact info</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const ContactAccordion = ({ borrower, role, ops }) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const contacts = borrower.contacts || [];
  const contact = contacts.find(c => c.role === role) || {};
  const roleLabel = CONTACT_ROLES.find(r => r.value === role)?.label || role;
  const [form, setForm] = useState({ name: contact.name || '', company: contact.company || '', address: contact.address || '', phone: contact.phone || '', email: contact.email || '' });

  const hasData = contact.name || contact.company;

  return (
    <div className="contact-accordion">
      <div className="contact-header" onClick={() => setOpen(o => !o)}>
        <span>{roleLabel}{hasData && ` — ${contact.name || contact.company}`}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>
      {open && (
        <div className="contact-body">
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[['Name', 'name'], ['Company', 'company'], ['Address', 'address'], ['Phone', 'phone'], ['Email', 'email']].map(([label, key]) => (
                <div key={key} className="field-row">
                  <label>{label}</label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ background: '#1a1a23', border: '1px solid #333345', color: '#e8e8f0', padding: '3px 7px', borderRadius: '4px', fontSize: '12px', outline: 'none', width: '100%' }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => { ops.upsertContact(borrower.id, role, form); setEditing(false); }}>Save</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {[['Name', contact.name], ['Company', contact.company], ['Address', contact.address], ['Phone', contact.phone], ['Email', contact.email]].map(([label, value]) => value ? (
                <div key={label} className="field-row">
                  <label>{label}</label>
                  <span style={{ color: '#e8e8f0' }}>{value}</span>
                </div>
              ) : null)}
              {!hasData && <span style={{ color: '#6a6a80', fontSize: '11px' }}>No contact info yet</span>}
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: '8px' }} onClick={() => setEditing(true)}>Edit</button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ---- PA Section (Purchase Agreement) ----
const PASection = ({ borrower, ops }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();
  const pa = borrower.purchase_agreement || {};

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) await uploadPA(file);
  };

  const uploadPA = async (file) => {
    try {
      const path = `${borrower.user_id}/${borrower.id}/pa_${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('Documents').upload(path, file);
      if (upErr) throw upErr;
      const { data: signedData } = await supabase.storage.from('Documents').createSignedUrl(path, 60 * 60 * 24 * 365);

      await ops.onUpdate(borrower.id, {
        purchase_agreement: {
          file_path: signedData?.signedUrl || '',
          file_name: file.name,
          uploaded_at: new Date().toISOString(),
          purchase_price: pa.purchase_price || '',
          close_of_escrow: pa.close_of_escrow || '',
          earnest_money: pa.earnest_money || '',
        }
      });
    } catch (e) {
      console.error('PA upload error:', e);
    }
  };

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          padding: '20px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer',
          background: dragging ? '#3b82f620' : '#fff',
          border: `2px dashed ${dragging ? '#3b82f6' : '#cbd5e1'}`,
          marginBottom: '12px',
        }}
      >
        {pa.file_path ? (
          <div>
            <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: '600' }}>✓ PA Uploaded</div>
            <a href={pa.file_path} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#3b82f6' }}>
              {pa.file_name || 'View PA'}
            </a>
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#64748b' }}>Drop PA here or click to browse</div>
        )}
      </div>
      <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadPA(e.target.files[0])} />

      {/* PA Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '11px', color: '#64748b', width: '100px' }}>Purchase Price</label>
          <input
            type="text"
            value={pa.purchase_price || ''}
            onChange={e => ops.onUpdate(borrower.id, { purchase_agreement: { ...pa, purchase_price: e.target.value } })}
            style={{ flex: 1, background: '#fff', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', color: '#1e293b' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '11px', color: '#64748b', width: '100px' }}>Close of Escrow</label>
          <input
            type="date"
            value={pa.close_of_escrow || ''}
            onChange={e => ops.onUpdate(borrower.id, { purchase_agreement: { ...pa, close_of_escrow: e.target.value } })}
            style={{ flex: 1, background: '#fff', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', color: '#1e293b' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '11px', color: '#64748b', width: '100px' }}>Earnest Money</label>
          <input
            type="text"
            value={pa.earnest_money || ''}
            onChange={e => ops.onUpdate(borrower.id, { purchase_agreement: { ...pa, earnest_money: e.target.value } })}
            style={{ flex: 1, background: '#fff', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', color: '#1e293b' }}
          />
        </div>
      </div>
    </div>
  );
};

// ---- Counters (counter-offers, stored inside purchase_agreement JSON) ----
const CountersSection = ({ borrower, ops }) => {
  const pa = borrower.purchase_agreement || {};
  const counters = pa.counters || [];
  const [form, setForm] = useState({ party: 'Seller', date: '', price: '', terms: '' });

  const save = (list) => ops.onUpdate(borrower.id, { purchase_agreement: { ...pa, counters: list } });
  const add = () => {
    if (!form.price && !form.terms) return;
    save([...counters, { ...form, id: Date.now() }]);
    setForm({ party: 'Seller', date: '', price: '', terms: '' });
  };
  const remove = (id) => save(counters.filter(c => c.id !== id));

  const inp = { background: '#fff', border: '1px solid #cbd5e1', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', color: '#1e293b' };

  return (
    <div>
      {counters.map((c, i) => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderTop: i ? '1px solid #f1f5f9' : 'none', fontSize: '12px' }}>
          <span style={{ fontWeight: 700, color: c.party === 'Buyer' ? '#1e3a5f' : '#475569', minWidth: '52px' }}>{c.party}</span>
          <span style={{ color: '#94a3b8', minWidth: '78px' }}>{c.date || '—'}</span>
          <span style={{ fontWeight: 700, color: '#1e293b', minWidth: '80px' }}>{c.price ? `$${c.price}` : ''}</span>
          <span style={{ flex: 1, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.terms}</span>
          <button onClick={() => remove(c.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '6px', marginTop: counters.length ? '10px' : '0', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={form.party} onChange={e => setForm(f => ({ ...f, party: e.target.value }))} style={{ ...inp, width: '78px' }}>
          <option>Seller</option><option>Buyer</option>
        </select>
        <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ ...inp, width: '130px' }} />
        <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="price" style={{ ...inp, width: '90px' }} />
        <input value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} onKeyDown={e => e.key === 'Enter' && add()} placeholder="terms / notes" style={{ ...inp, flex: 1, minWidth: '120px' }} />
        <button onClick={add} style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: '5px', padding: '7px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>Add</button>
      </div>
    </div>
  );
};

// ---- Needs List (kept for reference but tab removed) ----
const StipulationsSection = ({ borrower, ops }) => {
  const [newItem, setNewItem] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const stips = borrower.stipulations || [];
  const existingItems = stips.map(s => s.item);

  const addFromTemplate = async (items) => {
    for (const item of items) {
      if (!existingItems.includes(item)) {
        await ops.addStipulation(borrower.id, item);
      }
    }
  };

  const addMultiple = async (keys) => {
    for (const key of keys) {
      if (STIP_TEMPLATES[key]) {
        await addFromTemplate(STIP_TEMPLATES[key]);
      }
    }
    setShowTemplates(false);
  };

  // Smart suggestions based on loan_purpose and income_type
  const isPurchase = borrower.loan_purpose === 'Purchase';
  const isRefi = borrower.loan_purpose === 'Refinance' || borrower.loan_purpose === 'Refi';
  const incomeType = borrower.income_type || 'W2';

  const loanTypeTemplates = [
    { label: '🏠 Purchase Docs', keys: ['Purchase'], show: true },
    { label: '🔄 Refi Docs', keys: ['Refi'], show: true },
  ];

  const incomeTemplates = [
    { label: 'W2 Employee', keys: ['W2'], show: true },
    { label: 'Self-Employed', keys: ['SelfEmployed'], show: true },
    { label: 'VA Income', keys: ['VA'], show: true },
    { label: 'SSI Income', keys: ['SSI'], show: true },
    { label: 'Retirement', keys: ['Retirement'], show: true },
    { label: 'Rental Income', keys: ['Rental'], show: true },
    { label: 'Assets', keys: ['Assets'], show: true },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>📋 NEEDS LIST</div>
        <button type="button" style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
          onClick={() => setShowTemplates(t => !t)}>
          + Populate
        </button>
      </div>

      {showTemplates && (
        <div style={{ background: '#fff', border: '2px solid #0d9488', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '8px' }}>STEP 1: INCOME TYPE</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {incomeTemplates.map(t => (
              <button key={t.label} type="button" onClick={() => addMultiple(t.keys)}
                style={{ background: '#0d9488', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '8px' }}>STEP 2: LOAN TYPE</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {loanTypeTemplates.map(t => (
              <button key={t.label} type="button" onClick={() => addMultiple(t.keys)}
                style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1', maxHeight: '250px', overflowY: 'auto' }}>
        {stips.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>No needs yet. Click Populate or add manually.</div>
        )}
        {stips.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid #e2e8f0', background: s.received ? '#e5e7eb' : '#fff' }}>
            {s.received ? (
              <span style={{ fontSize: '16px' }}>✅</span>
            ) : (
              <button type="button" onClick={() => ops.markStipReceived(s.id, null)}
                style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                ✓
              </button>
            )}
            <span style={{ flex: 1, fontSize: '13px', color: '#1e293b', textDecoration: s.received ? 'line-through' : 'none' }}>{s.item}</span>
            {s.received && <span style={{ fontSize: '10px', color: '#64748b' }}>{s.received_date}</span>}
            <button type="button" onClick={() => ops.removeStipulation(s.id)}
              style={{ background: '#fee2e2', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#dc2626', fontSize: '12px', padding: '2px 6px', fontWeight: '700' }}>×</button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <input
          type="text"
          placeholder="Add custom stip…"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newItem.trim()) { ops.addStipulation(borrower.id, newItem.trim()); setNewItem(''); } }}
          style={{ flex: 1, background: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
        />
        <button type="button" onClick={() => { if (newItem.trim()) { ops.addStipulation(borrower.id, newItem.trim()); setNewItem(''); } }}
          style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
          Add
        </button>
      </div>

      {/* Email Template Section */}
      {stips.filter(s => !s.received).length > 0 && (
        <EmailTemplateSection borrower={borrower} stips={stips.filter(s => !s.received)} />
      )}
    </div>
  );
};

// Email Template for Needs List
const EmailTemplateSection = ({ borrower, stips }) => {
  const [copied, setCopied] = useState(false);

  // Get first name(s)
  const firstName = borrower.name?.split(' ')[0] || 'there';
  const coBorrowerFirst = borrower.co_borrower?.split(' ')[0];
  const greeting = coBorrowerFirst ? `${firstName} and ${coBorrowerFirst}` : firstName;

  // Build the needs list
  const needsList = stips.map(s => `  • ${s.item}`).join('\n');

  // Note: When pasting into Outlook, the link will be clickable
  const applyLink = 'https://westcapitallending.com/apply'; // Update this URL

  // Group stips by category for bold headers
  const incomeStips = stips.filter(s =>
    s.item.toLowerCase().includes('w2') || s.item.toLowerCase().includes('pay') ||
    s.item.toLowerCase().includes('tax') || s.item.toLowerCase().includes('1099') ||
    s.item.toLowerCase().includes('income') || s.item.toLowerCase().includes('employ')
  );
  const assetStips = stips.filter(s =>
    s.item.toLowerCase().includes('bank') || s.item.toLowerCase().includes('asset') ||
    s.item.toLowerCase().includes('statement') || s.item.toLowerCase().includes('investment')
  );
  const propertyStips = stips.filter(s =>
    s.item.toLowerCase().includes('contract') || s.item.toLowerCase().includes('hoa') ||
    s.item.toLowerCase().includes('insurance') || s.item.toLowerCase().includes('property') ||
    s.item.toLowerCase().includes('mortgage')
  );
  const otherStips = stips.filter(s =>
    !incomeStips.includes(s) && !assetStips.includes(s) && !propertyStips.includes(s)
  );

  const formatSection = (title, items) => {
    if (items.length === 0) return '';
    return `\n${title}\n${items.map(s => `  • ${s.item}`).join('\n')}`;
  };

  const emailTemplate = `Hi ${greeting},

Thank you for choosing West Capital Lending! My team and I are excited to help you through your home purchase.

To get started, please complete your loan application using the secure link below:
${applyLink}

Once your application is submitted, please scan, upload, email, or fax the following documents:

PURCHASE LOAN DOCUMENTATION CHECKLIST
${formatSection('INCOME DOCUMENTATION', incomeStips)}
${formatSection('ASSET DOCUMENTATION', assetStips)}
${formatSection('PROPERTY DOCUMENTATION', propertyStips)}
${formatSection('ADDITIONAL ITEMS', otherStips)}

IDENTIFICATION
  • Copy of driver's license or photo ID (ensure it's clear; phone photos are acceptable)

We look forward to working with you and helping you get into your new home smoothly. If you have any questions or need assistance, I'm available 24/7, and my team is happy to help.`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(emailTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ marginTop: '16px', background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '8px', padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#166534' }}>📧 Email Template</div>
        <button
          type="button"
          onClick={copyToClipboard}
          style={{
            background: copied ? '#22c55e' : '#166534',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {copied ? '✓ Copied!' : '📋 Copy Email'}
        </button>
      </div>
      <pre style={{
        background: '#fff',
        border: '1px solid #bbf7d0',
        borderRadius: '6px',
        padding: '12px',
        fontSize: '11px',
        color: '#1e293b',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        maxHeight: '200px',
        overflowY: 'auto',
        fontFamily: 'inherit',
        lineHeight: 1.5,
        margin: 0,
      }}>
        {emailTemplate}
      </pre>
    </div>
  );
};

// ---- Needs Section with Email/Text Templates ----
const NeedsSection = ({ borrower, ops }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [search, setSearch] = useState('');
  const [notifyStatus, setNotifyStatus] = useState(null);
  const searchRef = useRef();

  const stips = borrower.stipulations || [];
  const outstanding = stips.filter(s => !s.received);
  const received = stips.filter(s => s.received);
  const existingItems = stips.map(s => s.item);

  // Get borrower's first name(s) for templates
  const firstName = borrower.name?.split(',')[1]?.trim()?.split(' ')[0] || borrower.name?.split(' ')[0] || 'there';
  const coBorrowerFirst = borrower.co_borrower?.split(' ')[0];
  const greeting = coBorrowerFirst ? `${firstName} and ${coBorrowerFirst}` : firstName;

  // Categorize stips for email
  const categorizeStips = (stips) => {
    const income = [], assets = [], property = [], id = [], other = [];
    stips.forEach(s => {
      const item = s.item.toLowerCase();
      if (item.includes('w-2') || item.includes('w2') || item.includes('pay') || item.includes('tax') ||
          item.includes('1099') || item.includes('k-1') || item.includes('business') || item.includes('cpa') ||
          item.includes('social security') || item.includes('retirement') || item.includes('pension') ||
          item.includes('va ') || item.includes('disability') || item.includes('schedule e')) {
        income.push(s.item);
      } else if (item.includes('bank') || item.includes('statement') || item.includes('401k') ||
                 item.includes('ira') || item.includes('investment') || item.includes('gift')) {
        assets.push(s.item);
      } else if (item.includes('purchase') || item.includes('contract') || item.includes('insurance') ||
                 item.includes('hoa') || item.includes('mortgage') || item.includes('property') ||
                 item.includes('utility') || item.includes('appraisal') || item.includes('title')) {
        property.push(s.item);
      } else if (item.includes('license') || item.includes('id') || item.includes('photo') ||
                 item.includes('social security card') || item.includes('green card') || item.includes('coe') ||
                 item.includes('dd-214')) {
        id.push(s.item);
      } else {
        other.push(s.item);
      }
    });
    return { income, assets, property, id, other };
  };

  const cats = categorizeStips(outstanding);

  // Build HTML email body with bold headers
  const buildEmailBodyHTML = () => {
    let html = `<p>Hi ${greeting},</p>
<p>Thank you for choosing West Capital Lending! To continue processing your loan, we need the following documents:</p>
<p><strong>Purchase Loan Documentation Checklist</strong></p>`;
    if (cats.income.length > 0) {
      html += `<p><strong>Income Documentation</strong><br/>${cats.income.map(i => `&nbsp;&nbsp;&nbsp;• ${i}`).join('<br/>')}</p>`;
    }
    if (cats.assets.length > 0) {
      html += `<p><strong>Asset Documentation</strong><br/>${cats.assets.map(i => `&nbsp;&nbsp;&nbsp;• ${i}`).join('<br/>')}</p>`;
    }
    if (cats.property.length > 0) {
      html += `<p><strong>Property Documentation</strong><br/>${cats.property.map(i => `&nbsp;&nbsp;&nbsp;• ${i}`).join('<br/>')}</p>`;
    }
    if (cats.id.length > 0) {
      html += `<p><strong>Identification</strong><br/>${cats.id.map(i => `&nbsp;&nbsp;&nbsp;• ${i}`).join('<br/>')}</p>`;
    }
    if (cats.other.length > 0) {
      html += `<p><strong>Additional Items</strong><br/>${cats.other.map(i => `&nbsp;&nbsp;&nbsp;• ${i}`).join('<br/>')}</p>`;
    }
    html += `<p>Please scan, upload, email, or fax these at your earliest convenience.</p>
<p>If you have any questions, I'm happy to help!</p>
<p>Best,<br/>West Capital Lending Team</p>`;
    return html;
  };

  // Plain text version for clipboard
  const buildEmailBody = () => {
    let body = `Hi ${greeting},

Thank you for choosing West Capital Lending! To continue processing your loan, we need the following documents:

Purchase Loan Documentation Checklist
`;
    if (cats.income.length > 0) {
      body += `\nIncome Documentation\n${cats.income.map(i => `   • ${i}`).join('\n')}\n`;
    }
    if (cats.assets.length > 0) {
      body += `\nAsset Documentation\n${cats.assets.map(i => `   • ${i}`).join('\n')}\n`;
    }
    if (cats.property.length > 0) {
      body += `\nProperty Documentation\n${cats.property.map(i => `   • ${i}`).join('\n')}\n`;
    }
    if (cats.id.length > 0) {
      body += `\nIdentification\n${cats.id.map(i => `   • ${i}`).join('\n')}\n`;
    }
    if (cats.other.length > 0) {
      body += `\nAdditional Items\n${cats.other.map(i => `   • ${i}`).join('\n')}\n`;
    }
    body += `
Please scan, upload, email, or fax these at your earliest convenience.

If you have any questions, I'm happy to help!

Best,
West Capital Lending Team`;
    return body;
  };

  const emailSubject = `** NEEDS LIST ** ${borrower.name}`;
  const emailBody = buildEmailBody();
  const emailBodyHTML = buildEmailBodyHTML();

  // Text template (shorter)
  const needsList = outstanding.map(s => `• ${s.item}`).join('\n');
  const textBody = `Hi ${greeting}! We need the following docs for your loan:\n\n${needsList}\n\nPlease send when you can. Questions? Just reply here!`;

  // Notify Hailey - creates a task due immediately
  const notifyHailey = async () => {
    if (outstanding.length === 0) {
      setNotifyStatus('No outstanding stips to send');
      setTimeout(() => setNotifyStatus(null), 2000);
      return;
    }

    try {
      const taskTitle = `📧 Send stips list to ${borrower.name} (${outstanding.length} items)`;
      const today = new Date().toISOString().split('T')[0];
      // Use direct supabase insert instead of ops.addTask to avoid schema issues
      const { error } = await supabase.from('tasks').insert([{
        borrower_id: borrower.id,
        title: taskTitle,
        due_date: today,
        assigned_to: 'Hailey',
        type: 'task',
        completed: false,
      }]);
      if (error) throw error;
      const now = new Date();
      const stamp = `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
      setNotifyStatus(`✓ Task created for Hailey! (${stamp})`);
    } catch (e) {
      setNotifyStatus('Error: ' + e.message);
    }
  };

  const copyEmail = () => {
    // Copy HTML to clipboard for rich paste into Outlook
    const blob = new Blob([emailBodyHTML], { type: 'text/html' });
    const clipboardItem = new ClipboardItem({ 'text/html': blob, 'text/plain': new Blob([emailBody], { type: 'text/plain' }) });
    navigator.clipboard.write([clipboardItem]);
    alert('Email copied with bold headers! Paste into Outlook (Ctrl+V).\nSubject: ' + emailSubject);
  };

  const copyText = () => {
    navigator.clipboard.writeText(textBody);
    alert('Text copied!');
  };

  const addStip = async (item) => {
    await ops.addStipulation(borrower.id, item);
    setShowDropdown(false);
    setSearch('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflow: 'auto' }}>
      {/* Add stip dropdown - same style as main row */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => { setShowDropdown(!showDropdown); setTimeout(() => searchRef.current?.focus(), 50); }}
          style={{
            width: '100%', padding: '10px 14px', background: '#1a1a23',
            border: '1px solid #444', borderRadius: '6px', color: '#fff',
            fontSize: '12px', cursor: 'pointer', textAlign: 'left',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>+ Add stip from list</span>
          <ChevronDown size={14} style={{ transform: showDropdown ? 'rotate(180deg)' : 'none' }} />
        </button>

        {showDropdown && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: '#0d0d12', border: '1px solid #444', borderRadius: '6px',
            maxHeight: '250px', overflow: 'hidden', zIndex: 100, marginTop: '4px',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '8px', borderBottom: '1px solid #333' }}>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type to search stips..."
                style={{
                  width: '100%', padding: '6px 10px', background: '#1a1a23',
                  border: '1px solid #555', borderRadius: '4px', color: '#fff',
                  fontSize: '11px', outline: 'none',
                }}
              />
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {(() => {
                let hasMatches = false;
                const elements = Object.entries(STIP_CATEGORIES).map(([category, items]) => {
                  const filtered = items.filter(item =>
                    !existingItems.includes(item) &&
                    (!search || item.toLowerCase().includes(search.toLowerCase()))
                  );
                  if (filtered.length === 0) return null;
                  hasMatches = true;
                  return (
                    <div key={category}>
                      <div style={{
                        padding: '6px 10px', background: '#1e293b', color: '#94a3b8',
                        fontSize: '9px', fontWeight: '700', textTransform: 'uppercase',
                        position: 'sticky', top: 0,
                      }}>
                        {category}
                      </div>
                      {filtered.map((item, i) => (
                        <div
                          key={i}
                          onClick={() => addStip(item)}
                          style={{
                            padding: '6px 10px 6px 20px', cursor: 'pointer', fontSize: '11px',
                            color: '#ccc', borderBottom: '1px solid #222',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#1e3a5f'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  );
                });
                return (
                  <>
                    {elements}
                    {search.trim() && !hasMatches && (
                      <div
                        onClick={() => addStip(search.trim())}
                        style={{
                          padding: '8px 10px', cursor: 'pointer', fontSize: '11px',
                          color: '#a78bfa', background: '#1a1a23', borderTop: '1px solid #333',
                        }}
                      >
                        + Add "{search.trim()}" as custom
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Outstanding stips */}
      <div>
        <div style={{ fontSize: '10px', fontWeight: '700', color: '#f59e0b', marginBottom: '6px', textTransform: 'uppercase', textAlign: 'center' }}>
          Outstanding ({outstanding.length})
        </div>
        {outstanding.length === 0 ? (
          <div style={{ fontSize: '11px', color: '#888', padding: '8px', textAlign: 'center' }}>No outstanding items</div>
        ) : (
          <div style={{ background: '#1f1f0d', borderRadius: '6px', border: '1px solid #f59e0b33', maxHeight: '150px', overflow: 'auto' }}>
            {outstanding.map((s, idx) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                borderBottom: '1px solid #333', fontSize: '12px',
              }}>
                {idx === 0 && (
                  <button
                    onClick={async () => {
                      const today = new Date().toISOString().split('T')[0];
                      for (const stip of outstanding) {
                        await ops.markStipReceived(stip.id, today);
                      }
                    }}
                    style={{
                      width: '18px', height: '18px', borderRadius: '3px',
                      background: 'none', border: '2px solid #166534', cursor: 'pointer', flexShrink: 0,
                    }}
                    title="Select All"
                  />
                )}
                {idx !== 0 && <div style={{ width: '18px', flexShrink: 0 }} />}
                <button
                  onClick={() => ops.markStipReceived(s.id, new Date().toISOString().split('T')[0])}
                  style={{
                    width: '18px', height: '18px', borderRadius: '3px',
                    border: '2px solid #f59e0b', background: 'none', cursor: 'pointer', flexShrink: 0,
                  }}
                  title="Mark received"
                />
                <span style={{ flex: 1, color: '#fcd34d' }}>{s.item}</span>
                <button onClick={() => ops.removeStipulation(s.id)} style={{
                  background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '14px',
                }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Received stips */}
      {received.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b9b6b', marginBottom: '6px', textTransform: 'uppercase', textAlign: 'center' }}>
            Received ({received.length})
          </div>
          <div style={{ background: '#1a231a', borderRadius: '6px', border: '1px solid #2d4a2d', maxHeight: '100px', overflow: 'auto' }}>
            {received.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
                borderBottom: '1px solid #2d4a2d', fontSize: '11px', color: '#7cb87c',
                textDecoration: 'line-through', opacity: 0.6,
              }}>
                <Check size={14} style={{ color: '#6b9b6b' }} />
                <span style={{ flex: 1 }}>{s.item}</span>
                <span style={{ fontSize: '10px' }}>{s.received_date ? format(parseISO(s.received_date), 'M/d') : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions - below received */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={copyEmail} style={{
          padding: '8px 12px', background: '#166534', color: '#fff', border: 'none',
          borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
        }}>
          📧 Copy Email
        </button>
        <button onClick={copyText} style={{
          padding: '8px 12px', background: '#1d4ed8', color: '#fff', border: 'none',
          borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
        }}>
          💬 Copy Text
        </button>
        <button onClick={notifyHailey} style={{
          padding: '8px 12px', background: '#9333ea', color: '#fff', border: 'none',
          borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
        }}>
          🔔 Notify Hailey
        </button>
        {notifyStatus && (
          <span style={{ fontSize: '11px', color: notifyStatus.includes('✓') ? '#22c55e' : '#ef4444', alignSelf: 'center' }}>
            {notifyStatus}
          </span>
        )}
      </div>

      {/* Email preview */}
      <div style={{ marginTop: 'auto' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>EMAIL PREVIEW</div>
        <pre style={{
          background: '#1a1a23', border: '1px solid #333', borderRadius: '6px',
          padding: '10px', fontSize: '10px', color: '#94a3b8', whiteSpace: 'pre-wrap',
          maxHeight: '120px', overflow: 'auto', margin: 0, lineHeight: 1.4,
        }}>
          {emailBody}
        </pre>
      </div>
    </div>
  );
};

// ---- Loan Terms Grid ----
const LoanTermsGrid = ({ borrower, onUpdate }) => {
  const pi = calcPI(borrower.loan_amount, borrower.rate);
  const ltv = calcLTV(borrower.loan_amount, borrower.purchase_price);

  const Field = ({ label, value, dbKey, type = 'text' }) => {
    const [val, setVal] = useState(value || '');
    const save = () => { if (val !== (value || '')) onUpdate(borrower.id, { [dbKey]: val || null }); };
    return (
      <div className="loan-field">
        <label>{label}</label>
        <input type={type} value={val} onChange={e => setVal(e.target.value)} onBlur={save} />
      </div>
    );
  };

  return (
    <div>
      <div className="section-heading">💰 Loan Terms</div>
      <div className="loan-grid">
        <div className="loan-field">
          <label style={{ color: '#f59e0b' }}>Floating</label>
          <input
            type="checkbox"
            checked={borrower.floating || false}
            onChange={e => onUpdate(borrower.id, { floating: e.target.checked })}
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          />
        </div>
        <Field label="Lock Exp" value={borrower.lock_expiration} dbKey="lock_expiration" type="date" />
        <div className="loan-field">
          <label style={{ color: '#f59e0b' }}>Lock Extended?</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={borrower.lock_extended ? 'yes' : 'no'}
              onChange={e => {
                const isYes = e.target.value === 'yes';
                if (isYes) {
                  const newDate = prompt('Enter new lock expiration date (MM/DD/YYYY):');
                  if (newDate) {
                    const parsed = new Date(newDate);
                    if (!isNaN(parsed)) {
                      // New lock date replaces original - clear original lock_expiration
                      onUpdate(borrower.id, { lock_extended: true, rate_extended: parsed.toISOString().split('T')[0], lock_expiration: null });
                    }
                  }
                } else {
                  onUpdate(borrower.id, { lock_extended: false, rate_extended: null });
                }
              }}
              style={{ padding: '6px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>
        <Field label="New Lock Exp" value={borrower.rate_extended} dbKey="rate_extended" type="date" />
        <Field label="Purchase Price" value={borrower.purchase_price} dbKey="purchase_price" type="number" />
        <Field label="Loan Amount" value={borrower.loan_amount} dbKey="loan_amount" type="number" />
        <Field label="Rate (%)" value={borrower.rate} dbKey="rate" type="number" />
        <div className="loan-field">
          <label>P&I / mo</label>
          <input type="text" value={pi ? `$${Math.round(pi).toLocaleString()}` : '—'} readOnly style={{ color: '#9f67f7' }} />
        </div>
        <div className="loan-field">
          <label>LTV</label>
          <input type="text" value={ltv ? `${ltv}%` : (borrower.ltv ? `${borrower.ltv}%` : '—')} readOnly />
        </div>
        <Field label="DTI (%)" value={borrower.dti} dbKey="dti" type="number" />
        <Field label="Seller CC ($)" value={borrower.seller_cc} dbKey="seller_cc" type="number" />
        <Field label="COE Date" value={borrower.coe_date} dbKey="coe_date" type="date" />
        <Field label="Date Submitted" value={borrower.date_submitted} dbKey="date_submitted" type="date" />
        <Field label="Funded Date" value={borrower.funded_date} dbKey="funded_date" type="date" />
        <Field label="Lender" value={borrower.lender} dbKey="lender" />
        <Field label="Loan Type" value={borrower.loan_type} dbKey="loan_type" />
        <Field label="Property Type" value={borrower.property_type} dbKey="property_type" />
        <Field label="Occupancy" value={borrower.occupancy} dbKey="occupancy" />
        <Field label="Earnest Money" value={borrower.earnest_money} dbKey="earnest_money" type="number" />
      </div>
    </div>
  );
};

// ---- Calc Section (Dropdown with 4 calculators, auto-fills borrower data) ----
const CalcSection = ({ borrower }) => {
  const [selectedCalc, setSelectedCalc] = useState('');

  // Auto-fill from borrower
  const loanAmt = borrower.loan_amount || 400000;
  const purchasePrice = borrower.purchase_price || 500000;
  const rate = borrower.rate || 7.0;

  // VA Calculator state
  const [vaLoanAmt, setVaLoanAmt] = useState(loanAmt);
  const [vaDownPct, setVaDownPct] = useState(purchasePrice > 0 ? Math.round((1 - loanAmt / purchasePrice) * 100) : 0);
  const [vaFirstTime, setVaFirstTime] = useState(true);
  const [vaDisability, setVaDisability] = useState(false);

  // FHA Seasoning state
  const [fhaCloseDate, setFhaCloseDate] = useState('');
  const [fhaPayments, setFhaPayments] = useState(6);

  // Debt Consolidation state
  const [debts, setDebts] = useState([{ name: '', balance: 0, payment: 0, rate: 0 }]);
  const [newLoanAmt, setNewLoanAmt] = useState(loanAmt);
  const [newRate, setNewRate] = useState(rate);
  const [newTerm, setNewTerm] = useState(30);

  // Self-Employed state
  const [year1Income, setYear1Income] = useState(0);
  const [year2Income, setYear2Income] = useState(0);
  const [addBacks, setAddBacks] = useState(0);

  // Extra Payment state
  const [extraLoanAmt, setExtraLoanAmt] = useState(loanAmt);
  const [extraRate, setExtraRate] = useState(rate);
  const [extraTerm, setExtraTerm] = useState(30);
  const [extraPayment, setExtraPayment] = useState(200);

  // Blended Rate state (1st mortgage + HELOC/2nd)
  const [firstBalance, setFirstBalance] = useState(loanAmt);
  const [firstRate, setFirstRate] = useState(rate);
  const [secondBalance, setSecondBalance] = useState(50000);
  const [secondRate, setSecondRate] = useState(9.0);

  // VA Funding Fee calc
  const getVAFee = () => {
    if (vaDisability) return 0;
    if (vaDownPct >= 10) return vaFirstTime ? 1.25 : 1.25;
    if (vaDownPct >= 5) return vaFirstTime ? 1.5 : 1.5;
    return vaFirstTime ? 2.15 : 3.3;
  };
  const vaFee = getVAFee();
  const vaFeeAmt = vaLoanAmt * (vaFee / 100);
  const vaTotalLoan = vaLoanAmt + vaFeeAmt;

  // FHA Seasoning calc
  const calcFHASeasoning = () => {
    if (!fhaCloseDate) return null;
    const close = new Date(fhaCloseDate);
    const today = new Date();
    const monthsPassed = Math.floor((today - close) / (30 * 24 * 60 * 60 * 1000));
    const seasoningDate = new Date(close);
    seasoningDate.setMonth(seasoningDate.getMonth() + fhaPayments);
    return { monthsPassed, seasoningDate, isEligible: monthsPassed >= fhaPayments };
  };
  const fhaSeasoning = calcFHASeasoning();

  // Debt Consolidation calc
  const totalDebtPayment = debts.reduce((sum, d) => sum + (d.payment || 0), 0);
  const totalDebtBalance = debts.reduce((sum, d) => sum + (d.balance || 0), 0);
  const newPI = newLoanAmt > 0 ? (newLoanAmt * (newRate/100/12)) / (1 - Math.pow(1 + newRate/100/12, -newTerm*12)) : 0;
  const monthlySavings = totalDebtPayment - newPI;

  // Self-Employed calc (24-month average)
  const avgIncome = ((year1Income || 0) + (year2Income || 0)) / 2;
  const qualifyingIncome = avgIncome + (addBacks || 0);
  const monthlyIncome = qualifyingIncome / 12;

  // Extra Payment calc
  const monthlyRate = extraRate / 100 / 12;
  const normalPayment = extraLoanAmt > 0 ? (extraLoanAmt * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -extraTerm * 12)) : 0;
  const normalMonths = extraTerm * 12;
  const normalInterest = (normalPayment * normalMonths) - extraLoanAmt;

  // Calculate payoff with extra payment
  const calcExtraPayoff = () => {
    if (extraLoanAmt <= 0 || extraRate <= 0) return { months: 0, interest: 0 };
    let balance = extraLoanAmt;
    let months = 0;
    let totalInterest = 0;
    const totalPayment = normalPayment + extraPayment;
    while (balance > 0 && months < 360) {
      const interestThisMonth = balance * monthlyRate;
      totalInterest += interestThisMonth;
      const principalThisMonth = Math.min(totalPayment - interestThisMonth, balance);
      balance -= principalThisMonth;
      months++;
    }
    return { months, interest: totalInterest };
  };
  const extraResult = calcExtraPayoff();
  const monthsSaved = normalMonths - extraResult.months;
  const interestSaved = normalInterest - extraResult.interest;

  // Blended Rate calc
  const totalBalance = firstBalance + secondBalance;
  const blendedRate = totalBalance > 0
    ? ((firstBalance * firstRate) + (secondBalance * secondRate)) / totalBalance
    : 0;

  const addDebt = () => setDebts([...debts, { name: '', balance: 0, payment: 0, rate: 0 }]);
  const updateDebt = (i, field, val) => {
    const updated = [...debts];
    updated[i][field] = field === 'name' ? val : parseFloat(val) || 0;
    setDebts(updated);
  };

  const inputStyle = { width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #ccc', marginTop: '2px', fontSize: '11px' };
  const labelStyle = { fontSize: '10px', color: '#475569' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflow: 'auto', fontSize: '11px' }}>
      {/* Dropdown to select calculator */}
      <select value={selectedCalc} onChange={e => setSelectedCalc(e.target.value)}
        style={{ padding: '8px', borderRadius: '6px', border: '1px solid #3b82f6', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
        <option value="">Select Calculator...</option>
        <option value="debt">Debt Consolidation</option>
        <option value="se">Self-Employed Income</option>
        <option value="extra">Extra Payment</option>
        <option value="blended">Blended Rate</option>
        <option value="va">VA Funding Fee</option>
        <option value="fha">FHA Streamline Seasoning</option>
      </select>

      {/* VA Funding Fee */}
      {selectedCalc === 'va' && (
        <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
          <div style={{ fontWeight: '700', color: '#166534', marginBottom: '8px' }}>VA Funding Fee Calculator</div>
          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px' }}>Auto-filled from borrower: ${loanAmt.toLocaleString()}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <label style={labelStyle}>Loan Amount:
              <input type="number" value={vaLoanAmt} onChange={e => setVaLoanAmt(+e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>Down Payment %:
              <input type="number" value={vaDownPct} onChange={e => setVaDownPct(+e.target.value)} min="0" max="100" style={inputStyle} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="checkbox" checked={vaFirstTime} onChange={e => setVaFirstTime(e.target.checked)} /> First-time VA use
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="checkbox" checked={vaDisability} onChange={e => setVaDisability(e.target.checked)} /> Disability exempt
            </label>
          </div>
          <div style={{ marginTop: '10px', padding: '8px', background: '#dcfce7', borderRadius: '4px', textAlign: 'center' }}>
            <div>Fee: <strong>{vaFee}%</strong> = <strong>${vaFeeAmt.toLocaleString()}</strong></div>
            <div>Total Loan: <strong>${vaTotalLoan.toLocaleString()}</strong></div>
          </div>
        </div>
      )}

      {/* FHA Seasoning */}
      {selectedCalc === 'fha' && (
        <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '6px', border: '1px solid #fde68a' }}>
          <div style={{ fontWeight: '700', color: '#92400e', marginBottom: '8px' }}>FHA Streamline Seasoning</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <label style={labelStyle}>Original Close Date:
              <input type="date" value={fhaCloseDate} onChange={e => setFhaCloseDate(e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>Required Payments:
              <select value={fhaPayments} onChange={e => setFhaPayments(+e.target.value)} style={inputStyle}>
                <option value={6}>6 payments (standard)</option>
                <option value={12}>12 payments (some lenders)</option>
              </select>
            </label>
          </div>
          {fhaSeasoning && (
            <div style={{ marginTop: '10px', padding: '8px', background: fhaSeasoning.isEligible ? '#dcfce7' : '#fee2e2', borderRadius: '4px', textAlign: 'center' }}>
              <div>Months since close: <strong>{fhaSeasoning.monthsPassed}</strong></div>
              <div>Eligible date: <strong>{fhaSeasoning.seasoningDate.toLocaleDateString()}</strong></div>
              <div style={{ fontWeight: '700', color: fhaSeasoning.isEligible ? '#166534' : '#dc2626' }}>
                {fhaSeasoning.isEligible ? '✓ ELIGIBLE FOR STREAMLINE' : '✗ NOT YET SEASONED'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Debt Consolidation */}
      {selectedCalc === 'debt' && (
        <div style={{ background: '#ede9fe', padding: '12px', borderRadius: '6px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontWeight: '700', color: '#5b21b6', marginBottom: '8px' }}>Debt Consolidation Calculator</div>
          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px' }}>Add debts to consolidate:</div>
          {debts.map((d, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '4px', marginBottom: '4px' }}>
              <input placeholder="Debt name" value={d.name} onChange={e => updateDebt(i, 'name', e.target.value)} style={inputStyle} />
              <input placeholder="Balance" type="number" value={d.balance || ''} onChange={e => updateDebt(i, 'balance', e.target.value)} style={inputStyle} />
              <input placeholder="Payment" type="number" value={d.payment || ''} onChange={e => updateDebt(i, 'payment', e.target.value)} style={inputStyle} />
            </div>
          ))}
          <button onClick={addDebt} style={{ fontSize: '10px', color: '#5b21b6', background: 'none', border: 'none', cursor: 'pointer' }}>+ Add Debt</button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
            <label style={labelStyle}>New Loan Amt:
              <input type="number" value={newLoanAmt} onChange={e => setNewLoanAmt(+e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>Rate %:
              <input type="number" step="0.125" value={newRate} onChange={e => setNewRate(+e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>Term (yrs):
              <input type="number" value={newTerm} onChange={e => setNewTerm(+e.target.value)} style={inputStyle} />
            </label>
          </div>
          <div style={{ marginTop: '10px', padding: '8px', background: monthlySavings > 0 ? '#dcfce7' : '#fee2e2', borderRadius: '4px', textAlign: 'center' }}>
            <div>Total Debt Payments: <strong>${totalDebtPayment.toLocaleString()}/mo</strong></div>
            <div>New P&I: <strong>${Math.round(newPI).toLocaleString()}/mo</strong></div>
            <div style={{ fontWeight: '700', color: monthlySavings > 0 ? '#166534' : '#dc2626' }}>
              {monthlySavings > 0 ? `✓ SAVES $${Math.round(monthlySavings).toLocaleString()}/mo` : `✗ Costs $${Math.abs(Math.round(monthlySavings)).toLocaleString()} more/mo`}
            </div>
          </div>
        </div>
      )}

      {/* Self-Employed Income */}
      {selectedCalc === 'se' && (
        <div style={{ background: '#fce7f3', padding: '12px', borderRadius: '6px', border: '1px solid #f9a8d4' }}>
          <div style={{ fontWeight: '700', color: '#9d174d', marginBottom: '8px' }}>Self-Employed Income Calculator</div>
          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px' }}>24-month average method:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <label style={labelStyle}>Year 1 Net Income:
              <input type="number" value={year1Income || ''} onChange={e => setYear1Income(+e.target.value)} style={inputStyle} placeholder="From tax return" />
            </label>
            <label style={labelStyle}>Year 2 Net Income:
              <input type="number" value={year2Income || ''} onChange={e => setYear2Income(+e.target.value)} style={inputStyle} placeholder="From tax return" />
            </label>
          </div>
          <label style={{ ...labelStyle, marginTop: '8px', display: 'block' }}>Add-backs (depreciation, etc):
            <input type="number" value={addBacks || ''} onChange={e => setAddBacks(+e.target.value)} style={inputStyle} />
          </label>
          <div style={{ marginTop: '10px', padding: '8px', background: '#fbcfe8', borderRadius: '4px', textAlign: 'center' }}>
            <div>2-Year Average: <strong>${avgIncome.toLocaleString()}</strong></div>
            <div>+ Add-backs: <strong>${(addBacks || 0).toLocaleString()}</strong></div>
            <div style={{ fontWeight: '700', color: '#9d174d', fontSize: '13px', marginTop: '4px' }}>
              Monthly Qualifying: ${Math.round(monthlyIncome).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Extra Payment */}
      {selectedCalc === 'extra' && (
        <div style={{ background: '#ecfdf5', padding: '12px', borderRadius: '6px', border: '1px solid #6ee7b7' }}>
          <div style={{ fontWeight: '700', color: '#047857', marginBottom: '8px' }}>Extra Payment Calculator</div>
          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px' }}>Auto-filled from borrower: ${loanAmt.toLocaleString()} @ {rate}%</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <label style={labelStyle}>Loan Amount:
              <input type="number" value={extraLoanAmt} onChange={e => setExtraLoanAmt(+e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>Interest Rate %:
              <input type="number" step="0.125" value={extraRate} onChange={e => setExtraRate(+e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>Loan Term (years):
              <input type="number" value={extraTerm} onChange={e => setExtraTerm(+e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>Extra Monthly Payment:
              <input type="number" value={extraPayment} onChange={e => setExtraPayment(+e.target.value)} style={inputStyle} />
            </label>
          </div>
          <div style={{ marginTop: '10px', padding: '8px', background: '#d1fae5', borderRadius: '4px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>Normal Payoff</div>
                <div><strong>{normalMonths} months</strong></div>
                <div style={{ fontSize: '10px' }}>${Math.round(normalInterest).toLocaleString()} interest</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>With Extra ${extraPayment}/mo</div>
                <div><strong>{extraResult.months} months</strong></div>
                <div style={{ fontSize: '10px' }}>${Math.round(extraResult.interest).toLocaleString()} interest</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '8px', fontWeight: '700', color: '#047857', fontSize: '13px' }}>
              Save {monthsSaved} months & ${Math.round(interestSaved).toLocaleString()} in interest!
            </div>
          </div>
        </div>
      )}

      {/* Blended Rate */}
      {selectedCalc === 'blended' && (
        <div style={{ background: '#fef9c3', padding: '12px', borderRadius: '6px', border: '1px solid #fde047' }}>
          <div style={{ fontWeight: '700', color: '#a16207', marginBottom: '8px' }}>Blended Rate Calculator</div>
          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px' }}>Combine 1st mortgage + HELOC/2nd to see effective rate</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <label style={labelStyle}>1st Mortgage Balance:
              <input type="number" value={firstBalance} onChange={e => setFirstBalance(+e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>1st Mortgage Rate %:
              <input type="number" step="0.125" value={firstRate} onChange={e => setFirstRate(+e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>2nd/HELOC Balance:
              <input type="number" value={secondBalance} onChange={e => setSecondBalance(+e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>2nd/HELOC Rate %:
              <input type="number" step="0.125" value={secondRate} onChange={e => setSecondRate(+e.target.value)} style={inputStyle} />
            </label>
          </div>
          <div style={{ marginTop: '10px', padding: '10px', background: '#fef08a', borderRadius: '4px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#64748b' }}>Combined Balance</div>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>${totalBalance.toLocaleString()}</div>
            <div style={{ marginTop: '8px', fontSize: '10px', color: '#64748b' }}>Blended Rate</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#a16207' }}>{blendedRate.toFixed(3)}%</div>
          </div>
        </div>
      )}

      {!selectedCalc && (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
          Select a calculator above
        </div>
      )}
    </div>
  );
};

// ---- Sub Hub Section (Submit to Processing) ----
const SubHubSection = ({ borrower, onUpdate, ops }) => {
  const [dragOver, setDragOver] = useState(false);
  const [parseResult, setParseResult] = useState(null);

  const loanType = (borrower.loan_type || '').toLowerCase();
  const loanPurpose = (borrower.loan_purpose || '').toLowerCase();
  const isPurchase = loanPurpose.includes('purchase');
  const isHELOC = loanType.includes('heloc');
  const isFigure = (borrower.lender || '').toLowerCase().includes('figure');

  // Checklist items based on loan type
  const getChecklist = () => {
    const base = [
      { key: 'property_address', label: 'Subject Property', value: borrower.property_address },
      { key: 'name', label: 'Borrower Name', value: borrower.name },
      { key: 'loan_amount', label: 'Loan Amount', value: borrower.loan_amount },
      { key: 'rate', label: 'Interest Rate', value: borrower.rate },
      { key: 'apr', label: 'APR', value: borrower.apr },
      { key: 'loan_type', label: 'Loan Type', value: borrower.loan_type },
      { key: 'credit_auth_date', label: 'Credit Auth Date', value: borrower.credit_auth_date },
      { key: 'credit_score_mid', label: 'Mid Credit Score', value: borrower.credit_score_mid },
      { key: 'lender', label: 'Wholesale Lender', value: borrower.lender },
      { key: 'wholesale_loan_number', label: 'Lender Loan #', value: borrower.wholesale_loan_number },
    ];

    if (isPurchase) {
      base.push(
        { key: 'purchase_price', label: 'Purchase Price', value: borrower.purchase_price },
        { key: 'coe_date', label: 'COE Date', value: borrower.coe_date },
        { key: 'buyers_agent', label: 'Buyers Agent', value: borrower.contacts?.find(c => c.role === 'buyers_agent')?.name },
        { key: 'listing_agent', label: 'Listing Agent', value: borrower.contacts?.find(c => c.role === 'listing_agent')?.name },
        { key: 'title_escrow', label: 'Title/Escrow', value: borrower.contacts?.find(c => c.role === 'title_escrow')?.company || borrower.contacts?.find(c => c.role === 'title_escrow')?.name },
      );
    }

    if (!isFigure) {
      base.push({ key: 'processor_assigned', label: 'Processor Assigned (Siena)', value: borrower.processor_assigned });
    }

    base.push(
      { key: 'disclosures_signed', label: 'Disclosures Signed', value: borrower.disclosures_signed },
      { key: 'liabilities_entered', label: 'Liabilities Entered', value: borrower.liabilities_entered },
    );

    return base;
  };

  const checklist = getChecklist();
  const completedCount = checklist.filter(c => c.value).length;
  const totalCount = checklist.length;
  const pctComplete = Math.round((completedCount / totalCount) * 100);

  // Handle doc drop
  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    setParseResult({ status: 'analyzing' });
    try {
      const base64 = await fileToBase64(file);
      const { extracted } = await claudeService.analyzeDocument(base64, file.type || 'application/pdf', file.name);
      await applyExtractedData(borrower, extracted || {}, ops);
      setParseResult({ count: Object.keys(extracted || {}).length });
      if (ops?.refetch) ops.refetch();
    } catch (err) {
      console.error('Sub Hub doc read failed:', err);
      setParseResult({ error: err.message });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflow: 'auto', fontSize: '11px' }}>
      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontWeight: '600' }}>LP Setup Progress</span>
          <span style={{ fontWeight: '700', color: pctComplete === 100 ? '#16a34a' : '#f59e0b' }}>{pctComplete}%</span>
        </div>
        <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
          <div style={{ background: pctComplete === 100 ? '#16a34a' : '#3b82f6', height: '100%', width: `${pctComplete}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Loan type badge */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {isPurchase && <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>PURCHASE</span>}
        {isHELOC && <span style={{ background: '#fce7f3', color: '#be185d', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>HELOC</span>}
        {isFigure && <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>FIGURE (No Siena)</span>}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? '#3b82f6' : '#cbd5e1'}`,
          borderRadius: '8px', padding: '16px', textAlign: 'center',
          background: dragOver ? '#eff6ff' : '#f8fafc', cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: '600', color: dragOver ? '#3b82f6' : '#64748b' }}>
          Drop MISMO, Credit Report, or CD here
        </div>
        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>Auto-fills fields from document</div>
      </div>

      {parseResult && (
        <div style={{ background: parseResult.error ? '#fee2e2' : '#dcfce7', padding: '8px', borderRadius: '6px' }}>
          {parseResult.status === 'analyzing' ? (
            <div style={{ fontWeight: '600', color: '#166534' }}>🤖 Reading document…</div>
          ) : parseResult.error ? (
            <div style={{ fontWeight: '600', color: '#991b1b' }}>Error: {parseResult.error}</div>
          ) : (
            <div style={{ fontWeight: '600', color: '#166534' }}>✅ Document read — {parseResult.count || 0} fields filled</div>
          )}
        </div>
      )}

      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {checklist.map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: item.value ? '#f0fdf4' : '#fef2f2', borderRadius: '4px' }}>
            <span style={{ color: item.value ? '#16a34a' : '#dc2626', fontWeight: '700' }}>{item.value ? '✓' : '○'}</span>
            <span style={{ flex: 1, color: item.value ? '#166534' : '#991b1b' }}>{item.label}</span>
            <span style={{ fontSize: '10px', color: '#64748b', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.value || 'Missing'}
            </span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          onClick={() => window.open('https://prod.lendingpad.com', '_blank')}
          style={{ flex: 1, padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
        >
          Open LendingPad
        </button>
        <button
          onClick={() => {
            const text = checklist.map(c => `${c.label}: ${c.value || 'TBD'}`).join('\n');
            navigator.clipboard.writeText(text);
            alert('Checklist copied!');
          }}
          style={{ padding: '10px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Copy All
        </button>
      </div>
    </div>
  );
};

// ---- Get Paid Section (Funded Stage) ----
const GetPaidSection = ({ borrower, onUpdate }) => {
  const [dragOver, setDragOver] = useState(false);
  const [parseResult, setParseResult] = useState(null);

  // Commission deadline logic - flash yellow if approaching
  const fundedDate = borrower.funded_date ? new Date(borrower.funded_date) : null;
  const daysSinceFunded = fundedDate ? Math.floor((new Date() - fundedDate) / (1000 * 60 * 60 * 24)) : null;
  const isUrgent = daysSinceFunded !== null && daysSinceFunded >= 5 && daysSinceFunded <= 7;
  const isOverdue = daysSinceFunded !== null && daysSinceFunded > 7;

  const isHELOC = (borrower.loan_type || '').toLowerCase().includes('heloc');

  const getChecklist = () => {
    const items = [
      { key: 'funded_date', label: 'Funded Date', value: borrower.funded_date },
      { key: 'loan_amount', label: 'Final Loan Amount', value: borrower.loan_amount },
      { key: 'rate', label: 'Final Rate', value: borrower.rate },
      { key: 'broker_comp', label: 'Broker Comp', value: borrower.broker_comp },
      { key: 'lead_id', label: 'Lead ID', value: borrower.lead_id },
      { key: 'lead_cost', label: 'Lead Cost', value: borrower.lead_cost },
    ];

    // LP fields
    items.push(
      { key: 'lp_funded_entered', label: 'LP Funded Status Updated', value: borrower.lp_funded_entered },
    );

    // Paycom fields
    items.push(
      { key: 'paycom_entered', label: 'Paycom Submitted', value: borrower.paycom_entered },
    );

    if (isHELOC) {
      items.push(
        { key: 'heloc_docs_uploaded', label: 'HELOC Docs to Sharefolder', value: borrower.heloc_docs_uploaded },
      );
    }

    return items;
  };

  const checklist = getChecklist();
  const completedCount = checklist.filter(c => c.value).length;
  const totalCount = checklist.length;
  const pctComplete = Math.round((completedCount / totalCount) * 100);

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const text = await file.text();
    const { parseDocument } = await import('../lib/docParser');
    const result = parseDocument(text, file.name);
    setParseResult(result);

    if (Object.keys(result.extracted).length > 0) {
      onUpdate(borrower.id, result.extracted);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflow: 'auto', fontSize: '11px' }}>
      {/* Urgency alert */}
      {(isUrgent || isOverdue) && (
        <div style={{
          background: isOverdue ? '#fee2e2' : '#fef3c7',
          border: `2px solid ${isOverdue ? '#dc2626' : '#f59e0b'}`,
          padding: '10px', borderRadius: '8px', textAlign: 'center',
          animation: 'pulse 1s infinite',
        }}>
          <div style={{ fontWeight: '700', color: isOverdue ? '#dc2626' : '#92400e', fontSize: '13px' }}>
            {isOverdue ? 'COMMISSION AT RISK!' : 'SUBMIT SOON - Commission deadline approaching'}
          </div>
          <div style={{ fontSize: '10px', color: isOverdue ? '#991b1b' : '#78350f' }}>
            Funded {daysSinceFunded} days ago
          </div>
        </div>
      )}

      {/* Progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontWeight: '600' }}>Get Paid Progress</span>
          <span style={{ fontWeight: '700', color: pctComplete === 100 ? '#16a34a' : '#f59e0b' }}>{pctComplete}%</span>
        </div>
        <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
          <div style={{ background: pctComplete === 100 ? '#16a34a' : '#10b981', height: '100%', width: `${pctComplete}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {isHELOC && (
        <span style={{ background: '#fce7f3', color: '#be185d', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', alignSelf: 'flex-start' }}>HELOC - Different Process</span>
      )}

      {/* Drop zone for CD */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? '#10b981' : '#cbd5e1'}`,
          borderRadius: '8px', padding: '16px', textAlign: 'center',
          background: dragOver ? '#ecfdf5' : '#f8fafc', cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: '600', color: dragOver ? '#10b981' : '#64748b' }}>
          Drop Closing Disclosure here
        </div>
        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>Auto-extracts final numbers</div>
      </div>

      {parseResult && (
        <div style={{ background: '#dcfce7', padding: '8px', borderRadius: '6px' }}>
          <div style={{ fontWeight: '600', color: '#166534' }}>Extracted from CD:</div>
          <div style={{ fontSize: '10px', color: '#166534' }}>{Object.keys(parseResult.extracted).length} fields updated</div>
        </div>
      )}

      {/* Manual input for Lead ID/Cost */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <label style={{ fontSize: '10px', color: '#475569' }}>
          Lead ID:
          <input
            type="text"
            value={borrower.lead_id || ''}
            onChange={e => onUpdate(borrower.id, { lead_id: e.target.value })}
            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', marginTop: '2px' }}
            placeholder="From Lead Mailbox"
          />
        </label>
        <label style={{ fontSize: '10px', color: '#475569' }}>
          Lead Cost:
          <input
            type="number"
            value={borrower.lead_cost || ''}
            onChange={e => onUpdate(borrower.id, { lead_cost: parseFloat(e.target.value) || null })}
            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', marginTop: '2px' }}
            placeholder="$"
          />
        </label>
      </div>

      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {checklist.map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: item.value ? '#f0fdf4' : '#fef2f2', borderRadius: '4px' }}>
            <input
              type="checkbox"
              checked={!!item.value}
              onChange={e => onUpdate(borrower.id, { [item.key]: e.target.checked ? new Date().toISOString().split('T')[0] : null })}
            />
            <span style={{ flex: 1, color: item.value ? '#166534' : '#991b1b' }}>{item.label}</span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              {typeof item.value === 'boolean' ? (item.value ? 'Done' : '') : (item.value || '')}
            </span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          onClick={() => window.open('https://prod.lendingpad.com', '_blank')}
          style={{ flex: 1, padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
        >
          Open LP
        </button>
        <button
          onClick={() => window.open('https://paycomonline.net', '_blank')}
          style={{ flex: 1, padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
        >
          Open Paycom
        </button>
        <button
          onClick={() => window.open('https://leadmailbox.com', '_blank')}
          style={{ padding: '10px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Lead Mailbox
        </button>
      </div>
    </div>
  );
};

// ---- Bonzo Notes Section ----
const stripHtmlNotes = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();
};

const BonzoNotesSection = ({ borrower }) => {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [error, setError] = useState(null);

  // Auto-pull on mount
  React.useEffect(() => {
    if (borrower.bonzo_id) fetchBonzoNotes();
  }, [borrower.bonzo_id]);

  const fetchBonzoNotes = async () => {
    if (!borrower.bonzo_id) {
      setError('No Bonzo ID linked');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bonzo-notes?prospectId=${borrower.bonzo_id}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setNotes(data.notes || []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pushNote = async () => {
    if (!newNote.trim() || !borrower.bonzo_id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/bonzo-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectId: borrower.bonzo_id, note: newNote.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setNewNote('');
        fetchBonzoNotes();
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontSize: '12px', color: '#93c5fd' }}>
      {borrower.bonzo_id ? (
        <>
          <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
            <button
              onClick={fetchBonzoNotes}
              disabled={loading}
              style={{
                padding: '6px 12px', background: '#3b82f6', color: '#fff', border: 'none',
                borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
              }}
            >
              {loading ? 'Loading...' : 'Pull Notes'}
            </button>
          </div>
          <div style={{ marginBottom: '12px', display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Add note to Bonzo..."
              style={{
                flex: 1, padding: '6px 10px', background: '#0f2744', border: '1px solid #3b82f6',
                borderRadius: '4px', color: '#fff', fontSize: '12px',
              }}
              onKeyDown={e => e.key === 'Enter' && pushNote()}
            />
            <button
              onClick={pushNote}
              disabled={loading || !newNote.trim()}
              style={{
                padding: '6px 12px', background: '#22c55e', color: '#fff', border: 'none',
                borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
              }}
            >
              Push
            </button>
          </div>
          {error && <div style={{ color: '#f87171', marginBottom: '8px' }}>{error}</div>}
          {notes.length > 0 ? (
            <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {notes.map((n, i) => (
                <div key={i} style={{
                  padding: '10px', background: '#0f2744', borderRadius: '6px',
                  borderLeft: '3px solid #3b82f6',
                }}>
                  <div style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '4px' }}>{n.date}</div>
                  <div style={{ color: '#fff', fontSize: '16px', lineHeight: 1.6 }}>{stripHtmlNotes(n.body)}</div>
                </div>
              ))}
            </div>
          ) : !loading && (
            <div style={{ color: '#fff', textAlign: 'center', padding: '20px' }}>
              No notes found
            </div>
          )}
        </>
      ) : (
        <div style={{ color: '#fff', textAlign: 'center', padding: '20px' }}>
          No Bonzo ID linked. Sync from Bonzo first.
        </div>
      )}
    </div>
  );
};

// Communication view lives in CommunicationPanel.jsx (reused by the row CONVO popup).
const CommunicationSection = CommunicationPanel;

// ---- Notify LOA Section ----
const NotifyLOASection = ({ borrower }) => {
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const LOA_EMAIL = 'hrose@westcapitallending.com';
  const LOA_NAME = 'H. Rose';

  const sendEmail = () => {
    const subject = `File Update: ${borrower.name}`;
    const body = message || `Please review the file for ${borrower.name}.`;
    window.open(`mailto:${LOA_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    const now = new Date();
    const stamp = `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
    setStatus(`✓ Email opened! (${stamp})`);
  };

  const createTask = async () => {
    try {
      const taskTitle = message || `Review file: ${borrower.name}`;
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('tasks').insert([{
        borrower_id: borrower.id,
        title: taskTitle,
        due_date: today,
        assigned_to: LOA_NAME,
        type: 'task',
        completed: false,
      }]);
      if (error) throw error;
      const now = new Date();
      const stamp = `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
      setStatus(`✓ Task created for LOA! (${stamp})`);
    } catch (e) {
      setStatus('Error: ' + e.message);
    }
  };

  const bothActions = async () => {
    await createTask();
    const now = new Date();
    const stamp = `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
    sendEmail();
    setStatus(`✓ Task + Email done! (${stamp})`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
      <div style={{ fontSize: '11px', color: '#64748b' }}>
        Notify <strong>{LOA_NAME}</strong> about: <strong>{borrower.name}</strong>
      </div>

      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Message to include (optional)..."
        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '11px', minHeight: '60px', resize: 'vertical' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button onClick={sendEmail}
          style={{ padding: '10px', background: '#dbeafe', border: '1px solid #3b82f6', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '11px' }}>
          <span style={{ fontWeight: '600' }}>📧 Email LOA</span>
          <span style={{ color: '#64748b', marginLeft: '8px' }}>Opens email to {LOA_EMAIL}</span>
        </button>
        <button onClick={createTask}
          style={{ padding: '10px', background: '#dcfce7', border: '1px solid #22c55e', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '11px' }}>
          <span style={{ fontWeight: '600' }}>📋 Create Task</span>
          <span style={{ color: '#64748b', marginLeft: '8px' }}>Assigns task to {LOA_NAME}</span>
        </button>
        <button onClick={bothActions}
          style={{ padding: '10px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '11px' }}>
          <span style={{ fontWeight: '600' }}>⚡ Both</span>
          <span style={{ color: '#64748b', marginLeft: '8px' }}>Email + Task</span>
        </button>
      </div>

      {status && (
        <div style={{ padding: '8px', background: status.includes('✓') ? '#dcfce7' : '#fef3c7', borderRadius: '6px', textAlign: 'center', fontSize: '11px' }}>
          {status}
        </div>
      )}
    </div>
  );
};

// ---- Borrowers Section ----
const BorrowersSection = ({ borrower, onUpdate }) => {
  const [name, setName] = useState(borrower.name || '');
  const [coBorrowers, setCoBorrowers] = useState(borrower.co_borrowers || (borrower.co_borrower ? [borrower.co_borrower] : []));
  const [nbs, setNbs] = useState(borrower.non_borrowing_spouse || '');

  const save = (field, val) => onUpdate(borrower.id, { [field]: val || null });

  const updateCoBorrower = (idx, val) => {
    const updated = [...coBorrowers];
    updated[idx] = val;
    setCoBorrowers(updated);
  };

  const saveCoBorrowers = () => {
    const filtered = coBorrowers.filter(c => c.trim());
    onUpdate(borrower.id, { co_borrowers: filtered, co_borrower: filtered[0] || null });
  };

  const addCoBorrower = () => setCoBorrowers([...coBorrowers, '']);

  const removeCoBorrower = (idx) => {
    const updated = coBorrowers.filter((_, i) => i !== idx);
    setCoBorrowers(updated);
    onUpdate(borrower.id, { co_borrowers: updated, co_borrower: updated[0] || null });
  };

  const fieldStyle = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', background: '#fff' };
  const labelStyle = { fontSize: '11px', color: '#64748b', marginBottom: '4px', fontWeight: '600' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <div style={labelStyle}>Primary Borrower</div>
        <input style={fieldStyle} value={name} onChange={e => setName(e.target.value)} onBlur={() => save('name', name)} placeholder="LASTNAME, First" />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={labelStyle}>Co-Borrower(s)</div>
          <button type="button" onClick={addCoBorrower} style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
            <Plus size={10} /> Add
          </button>
        </div>
        {coBorrowers.length === 0 && (
          <div style={{ color: '#94a3b8', fontSize: '11px' }}>No co-borrowers. Click + Add to add one.</div>
        )}
        {coBorrowers.map((cb, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <input style={{ ...fieldStyle, flex: 1 }} value={cb} onChange={e => updateCoBorrower(idx, e.target.value)} onBlur={saveCoBorrowers} placeholder="LASTNAME, First" />
            <button type="button" onClick={() => removeCoBorrower(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}><X size={16} /></button>
          </div>
        ))}
      </div>
      <div>
        <div style={labelStyle}>Non-Borrowing Spouse (for title)</div>
        <input style={fieldStyle} value={nbs} onChange={e => setNbs(e.target.value)} onBlur={() => save('non_borrowing_spouse', nbs)} placeholder="Full name (leave blank if none)" />
      </div>
    </div>
  );
};

// ---- Preapproval Section ----
const PreapprovalSection = ({ borrower, onUpdate }) => {
  const [valApproved, setValApproved] = useState(borrower.val_approved || false);
  const [copied, setCopied] = useState(false);

  // Letter form state
  const [letter, setLetter] = useState({
    term: '360',
    programType: 'Correspondent',
    rateType: 'Fixed',
    occupancy: borrower.occupancy || 'Primary Residence',
    salesPrice: borrower.purchase_price || '',
    loanAmount: borrower.loan_amount || '',
    state: 'CA',
  });

  // Calculate down payment and LTV
  const calcDownPayment = () => {
    if (letter.salesPrice && letter.loanAmount) {
      const dp = Number(letter.salesPrice) - Number(letter.loanAmount);
      return dp > 0 ? dp : 0;
    }
    return 0;
  };

  const calcLtvPercent = () => {
    if (letter.salesPrice && letter.loanAmount && Number(letter.salesPrice) > 0) {
      return ((Number(letter.loanAmount) / Number(letter.salesPrice)) * 100).toFixed(2);
    }
    return '';
  };

  const fieldStyle = { width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', background: '#fff' };
  const labelStyle = { fontSize: '9px', color: '#64748b', marginBottom: '2px', fontWeight: '600', textTransform: 'uppercase' };

  const save = (field, val) => onUpdate(borrower.id, { [field]: val });

  // Auto-populate borrower name
  const borrowerName = borrower.name || 'Applicant';
  const today = format(new Date(), 'MM/dd/yyyy');
  const expiresDate = format(addDays(new Date(), 30), 'MM/dd/yyyy');
  const termMonths = letter.term || '360';
  const downPaymentCalc = calcDownPayment();
  const downPaymentPercent = letter.salesPrice && downPaymentCalc ? ((downPaymentCalc / Number(letter.salesPrice)) * 100).toFixed(2) : '';
  const ltvCalc = calcLtvPercent();

  const generateLetterText = () => `WEST CAPITAL LENDING
Mortgage Pre-Approval Letter
${today}

Congratulations! We are pleased to inform you that you have been pre-approved for a home loan with us. I'm looking forward to helping you purchase your new home. Please don't hesitate to call me with any questions.

CLIENT INFORMATION
Applicant(s): ${borrowerName}
Property Address: ${letter.state}

Terms: ${termMonths} months
Program: ${letter.programType} ${letter.rateType === 'Fixed' ? 'Fixed Rate' : 'Adjustable Rate'}
Sales Price: ${letter.salesPrice ? '$' + Number(letter.salesPrice).toLocaleString() : ''}
Loan Amount: ${letter.loanAmount ? '$' + Number(letter.loanAmount).toLocaleString() : ''}
Down Payment: ${downPaymentPercent ? downPaymentPercent + '%' : ''}
Loan-to-Value: ${ltvCalc ? ltvCalc + '%' : ''}
Occupancy: ${letter.occupancy}

REVIEW PROGRESS
A licensed Loan Officer has reviewed the following:
✓ Reviewed applicant's credit report and credit score
✓ Verified applicant's income
✓ Reviewed applicant's debt to income ratio

This approval expires after 30 days on ${expiresDate}.

Sincerely,

Danielle Regnier
Loan Officer
NMLS ID: 399441
Work: (949) 799-2130
Mobile: (949) 799-2130
dregnier@westcapitallending.com

West Capital Lending, Inc.
NMLS ID: 1566096
17911 Von Karman Avenue, suite 400 Irvine, CA 92614`;

  const copyLetter = () => {
    navigator.clipboard.writeText(generateLetterText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* VAL - top right style */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: valApproved ? '#dcfce7' : '#f1f5f9', borderRadius: '6px', border: `1px solid ${valApproved ? '#22c55e' : '#e2e8f0'}`, cursor: 'pointer' }}>
          <input type="checkbox" checked={valApproved} onChange={e => { setValApproved(e.target.checked); save('val_approved', e.target.checked); }}
            style={{ width: '14px', height: '14px', accentColor: '#22c55e' }} />
          <span style={{ fontWeight: '600', fontSize: '11px', color: valApproved ? '#166534' : '#64748b' }}>VAL ✓</span>
        </label>
      </div>

      {/* Letter Generator Form */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>📄 Pre-Approval Letter Generator</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          <div>
            <div style={labelStyle}>Term</div>
            <select value={letter.term} onChange={e => setLetter(l => ({ ...l, term: e.target.value }))} style={fieldStyle}>
              <option value="360">30yr (360mo)</option>
              <option value="240">20yr (240mo)</option>
              <option value="180">15yr (180mo)</option>
              <option value="120">10yr (120mo)</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>Rate Type</div>
            <select value={letter.rateType} onChange={e => setLetter(l => ({ ...l, rateType: e.target.value }))} style={fieldStyle}>
              <option value="Fixed">Fixed</option>
              <option value="Adjustable">Adjustable</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>Program</div>
            <select value={letter.programType} onChange={e => setLetter(l => ({ ...l, programType: e.target.value }))} style={fieldStyle}>
              <option value="Correspondent">Correspondent</option>
              <option value="Wholesale">Wholesale</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>Occupancy</div>
            <select value={letter.occupancy} onChange={e => setLetter(l => ({ ...l, occupancy: e.target.value }))} style={fieldStyle}>
              <option value="Primary Residence">Primary</option>
              <option value="Secondary Residence">Secondary</option>
              <option value="Investment Property">Investment</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>Sales Price</div>
            <input type="number" value={letter.salesPrice} onChange={e => setLetter(l => ({ ...l, salesPrice: e.target.value }))} style={fieldStyle} placeholder="Enter amount" />
          </div>
          <div>
            <div style={labelStyle}>Loan Amount</div>
            <input type="number" value={letter.loanAmount} onChange={e => setLetter(l => ({ ...l, loanAmount: e.target.value }))} style={fieldStyle} placeholder="Enter amount" />
          </div>
          <div>
            <div style={labelStyle}>State</div>
            <select value={letter.state} onChange={e => setLetter(l => ({ ...l, state: e.target.value }))} style={fieldStyle}>
              <option value="CA">CA</option>
              <option value="AZ">AZ</option>
              <option value="NV">NV</option>
              <option value="TX">TX</option>
              <option value="WA">WA</option>
              <option value="OR">OR</option>
              <option value="CO">CO</option>
              <option value="FL">FL</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>Down Payment</div>
            <div style={{ ...fieldStyle, background: '#f8fafc', color: '#475569', fontWeight: '600' }}>
              {downPaymentCalc ? `$${Number(downPaymentCalc).toLocaleString()} (${downPaymentPercent}%)` : '—'}
            </div>
          </div>
          <div>
            <div style={labelStyle}>LTV</div>
            <div style={{ ...fieldStyle, background: '#f8fafc', color: '#475569', fontWeight: '600' }}>
              {ltvCalc ? `${ltvCalc}%` : '—'}
            </div>
          </div>
        </div>

        {/* Copy Button */}
        <button
          onClick={copyLetter}
          style={{
            width: '100%', padding: '10px',
            background: copied ? '#22c55e' : '#1e40af',
            color: '#fff',
            border: 'none', borderRadius: '6px',
            fontSize: '12px', fontWeight: '700',
            cursor: 'pointer',
            marginBottom: '8px',
          }}
        >
          {copied ? '✓ Copied!' : '📋 Copy Pre-Approval Letter'}
        </button>

        {/* Preview */}
        <details style={{ marginTop: '8px' }}>
          <summary style={{ fontSize: '10px', color: '#64748b', cursor: 'pointer', fontWeight: '600' }}>Preview Letter</summary>
          <pre style={{ fontSize: '9px', color: '#1e293b', whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '8px 0 0 0', lineHeight: 1.3, background: '#f8fafc', padding: '8px', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto' }}>
            {generateLetterText()}
          </pre>
        </details>
      </div>
    </div>
  );
};

// ---- Appraisal Section ----
const APPRAISAL_TYPES = [
  '2075 Drive By (exterior inspection with no value)',
  'Conv 1004 + 1007',
  'Conventional 1004 SFR with 1007 rent schedule & 216 Operating income statement',
  'Conventional 1004 SFR with 216 Operating income statement',
  'Conventional 1004 Single family residence',
  'Conventional 1004C Manufactured home',
  'Conventional 1004C Manufactured home with 1007 rent schedule',
  'Conventional 1004C Manufactured home with 1007 rent schedule & 216 Operating income statement',
  'Conventional 1073 Condo',
  'FHA 1004 SFR with 1007 Rent schedule',
  'FHA 1004 SFR with 1007 Rent schedule & 216 Operating income statement',
  'FHA 1004 SFR with 216 Operating income statement',
  'FHA 1004 Single family residence',
  'FHA 1073 Condo',
  'Other',
];

// ---- Credit Report Section ----
// Pull per-person credit scores out of an AI result (credit_people array for joint
// reports, else the single-person FICO/Vantage fields).
const extractCreditPeople = (extracted) => {
  if (Array.isArray(extracted.credit_people) && extracted.credit_people.length) {
    return extracted.credit_people.map(p => ({
      name: p.name,
      scores: { equifax: p.fico_equifax, experian: p.fico_experian, transunion: p.fico_transunion },
      vantage_scores: { equifax: p.vantage_equifax, experian: p.vantage_experian, transunion: p.vantage_transunion },
      negative_marks: p.negative_marks, public_records: p.public_records,
      negative_items: p.negative_items || [], public_record_items: p.public_record_items || [],
    }));
  }
  const cs = buildCreditScores(extracted);
  return [{
    name: extracted.borrower_name, scores: cs.scores || {}, vantage_scores: cs.vantage_scores || {},
    negative_marks: cs.negative_marks, public_records: cs.public_records,
    negative_items: extracted.negative_items || [], public_record_items: extracted.public_record_items || [],
  }];
};

// "1yr 11mo" elapsed since a discharge/filed date
const sinceDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  let months = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (months < 0) return '';
  const yrs = Math.floor(months / 12);
  const mos = Math.floor(months % 12);
  return `${yrs ? yrs + 'yr ' : ''}${mos}mo`.trim();
};

const CreditReportSection = ({ borrower, onUpdate }) => {
  const [uploading, setUploading] = useState(false);
  const [signedUrl, setSignedUrl] = useState(null);
  const [openDetail, setOpenDetail] = useState({}); // `${key}:${kind}` -> bool
  const inputRef = useRef();

  const cr = borrower.credit_report || {};
  // Back-compat: an old flat credit_report becomes the primary person's report
  const peopleData = cr.people || ((cr.scores || cr.file_path || cr.uploaded_at) ? { primary: cr } : {});
  const joint = !!cr.joint;

  const coBorrowers = borrower.co_borrowers?.length ? borrower.co_borrowers : (borrower.co_borrower ? [borrower.co_borrower] : []);
  const people = [{ key: 'primary', label: borrower.name || 'Primary Borrower' }, ...coBorrowers.map((cb, i) => ({ key: `co_${i}`, label: cb }))];

  const setJoint = (val) => onUpdate(borrower.id, { credit_report: { ...cr, joint: val } });

  const tokens = (n) => (n || '').toLowerCase().match(/[a-z]{2,}/g) || [];
  // Match a report's person name to a borrower on the file (shared name word), else next open slot
  const matchPersonKey = (reportName, used) => {
    const rt = tokens(reportName);
    for (const person of people) {
      if (used.has(person.key)) continue;
      const pt = tokens(person.label);
      if (rt.length && pt.length && rt.some(t => pt.includes(t))) return person.key;
    }
    const open = people.find(p => !used.has(p.key));
    return open ? open.key : 'primary';
  };

  // Drop one or more reports at once — each is read and routed to the right person.
  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const newPeople = { ...peopleData };
      const history = [...(cr.history || [])];
      const used = new Set();
      let lastExtracted = {};
      for (const file of files) {
        const fileName = `credit_${borrower.id}_${Date.now()}_${Math.round(Math.random() * 1e6)}.pdf`;
        const { error } = await supabase.storage.from('Documents').upload(fileName, file);
        let fileInfo = { file_name: file.name, uploaded_at: new Date().toISOString() };
        if (!error) {
          const { data: urlData } = supabase.storage.from('Documents').getPublicUrl(fileName);
          fileInfo = { ...fileInfo, file_path: fileName, file_url: urlData.publicUrl };
        }
        let extracted = {};
        try {
          const base64 = await fileToBase64(file);
          const result = await claudeService.analyzeDocument(base64, file.type || 'application/pdf', file.name);
          extracted = result.extracted || {};
        } catch (e) { console.error('Credit AI read failed:', e); }
        lastExtracted = extracted;

        const ppl = extractCreditPeople(extracted);
        let personLabel = 'Joint';
        if (joint) {
          people.forEach((person, idx) => { const e = ppl[idx] || ppl[0] || {}; newPeople[person.key] = { label: person.label, ...e, ...fileInfo }; });
        } else {
          const e = ppl[0] || {};
          const key = matchPersonKey(e.name, used);
          used.add(key);
          personLabel = people.find(p => p.key === key)?.label || 'Borrower';
          newPeople[key] = { label: personLabel, ...e, ...fileInfo };
        }
        history.unshift({ ...fileInfo, person: personLabel }); // newest first
      }
      const update = { credit_report: { ...cr, joint, people: newPeople, history } };
      const primary = newPeople.primary;
      if (primary) { const mid = midScore(primary.scores) || midScore(primary.vantage_scores); if (mid) update.credit_score_mid = mid; }
      if (lastExtracted.credit_auth_date) update.credit_auth_date = lastExtracted.credit_auth_date;
      await onUpdate(borrower.id, update);
    } catch (err) {
      alert('Failed to upload: ' + err.message);
    }
    setUploading(false);
  };

  const openReport = async (rep) => {
    if (rep?.file_path) {
      const { data } = await supabase.storage.from('Documents').createSignedUrl(rep.file_path, 3600);
      if (data?.signedUrl) setSignedUrl(data.signedUrl);
    } else if (rep?.file_url) setSignedUrl(rep.file_url);
  };

  const dropZone = (label) => (
    <div
      onDragOver={e => e.preventDefault()}
      onDrop={async e => { e.preventDefault(); await uploadFiles(e.dataTransfer?.files); }}
      onClick={() => inputRef.current?.click()}
      style={{ padding: '16px', borderRadius: '8px', marginBottom: '12px', background: '#f1f5f9', border: '2px dashed #94a3b8', textAlign: 'center', cursor: 'pointer' }}
    >
      <FileText size={22} style={{ color: '#64748b', marginBottom: '4px' }} />
      <div style={{ fontSize: '12px', color: '#475569', fontWeight: '700' }}>{uploading ? 'Reading…' : label}</div>
    </div>
  );

  const redCell = (label, count, onClick) => (
    <div onClick={count > 0 ? onClick : undefined}
      style={{ background: count > 0 ? '#fee2e2' : '#f1f5f9', padding: '6px 3px', borderRadius: '6px', textAlign: 'center', cursor: count > 0 ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', lineHeight: 1.2 }}>{label}</div>
      <div style={{ fontSize: '15px', fontWeight: '700', color: count > 0 ? '#dc2626' : '#1e293b' }}>{count}{count > 0 ? ' ▾' : ''}</div>
    </div>
  );

  const scoreCard = (person, rep) => {
    const s = rep.scores || {};
    const v = rep.vantage_scores || {};
    const hasV = Object.values(v).some(Boolean);
    const negItems = rep.negative_items || [];
    const pubItems = rep.public_record_items || [];
    const isCO = (it) => /charge.?off/i.test(`${it.type || ''} ${it.status || ''}`);
    const isBK = (it) => /bankrupt/i.test(`${it.type || ''} ${it.status || ''}`);
    // BK shows only under Public Records; charge-offs float to the top
    const displayNeg = negItems.filter(it => !isBK(it)).sort((a, b) => (isCO(b) ? 1 : 0) - (isCO(a) ? 1 : 0));
    const negCount = negItems.length ? displayNeg.length : (rep.negative_marks || 0);
    const pubCount = rep.public_records || pubItems.length || 0;
    const negKey = `${person.key}:neg`, pubKey = `${person.key}:pub`;
    const toggle = (k) => setOpenDetail(o => ({ ...o, [k]: !o[k] }));
    const detailBox = { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px', marginTop: '8px', fontSize: '11px', color: '#7f1d1d', lineHeight: 1.6 };
    return (
      <div key={person.key} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>📄 {person.label}</div>
          {(rep.file_path || rep.file_url) && (
            <button onClick={() => openReport(rep)} style={{ background: '#1e3a5f', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>View</button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.9fr 1fr 1fr', gap: '8px', alignItems: 'stretch' }}>
          <div style={{ background: '#f1f5f9', padding: '10px 8px', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>FICO (EQ/EX/TU)</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>{s.equifax || '—'} / {s.experian || '—'} / {s.transunion || '—'}</div>
            {hasV && (
              <>
                <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', marginTop: '6px' }}>Vantage (EQ/EX/TU)</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f' }}>{v.equifax || '—'} / {v.experian || '—'} / {v.transunion || '—'}</div>
              </>
            )}
          </div>
          {redCell('Negative Marks', negCount, () => toggle(negKey))}
          {redCell('Public Records', pubCount, () => toggle(pubKey))}
        </div>

        {openDetail[negKey] && (
          <div style={detailBox}>
            <div style={{ fontWeight: 700, marginBottom: '2px' }}>Negative items</div>
            {displayNeg.length ? displayNeg.map((it, i) => {
              const co = isCO(it);
              const paid = /paid/i.test(it.status || '');
              const statusTxt = co ? (paid ? 'PAID THRU COLLECTIONS' : 'CHARGED OFF') : (it.status || '');
              return (
                <div key={i}>
                  • {it.creditor || 'Account'} — {co ? <strong>CHARGE OFF</strong> : (it.type || 'Account')}
                  {it.balance ? ` · $${Number(it.balance).toLocaleString()}` : ''}
                  {statusTxt ? ` · ${statusTxt}` : ''}
                  {!co && it.last_late_date ? ` · last late ${it.last_late_date}` : ''}
                  {!co && it.rolling ? ' · 🔁 ROLLING' : ''}
                </div>
              );
            }) : <div>No itemized negatives{negCount > 0 ? ' — click View to see them' : ''}.</div>}
          </div>
        )}
        {openDetail[pubKey] && (
          <div style={detailBox}>
            <div style={{ fontWeight: 700, marginBottom: '2px' }}>Public records</div>
            {pubItems.length ? pubItems.map((it, i) => (
              <div key={i}>
                • <strong>{it.type || 'Record'}</strong>
                {it.discharge_date ? ` — discharged ${it.discharge_date} (${sinceDate(it.discharge_date)} ago)` : it.filed_date ? ` — filed ${it.filed_date}` : ''}
                {it.status ? ` · ${it.status}` : ''}
              </div>
            )) : <div>Not itemized by the report — click <strong>View</strong> to see them.</div>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
        onChange={async e => { await uploadFiles(e.target.files); if (inputRef.current) inputRef.current.value = ''; }} />

      {coBorrowers.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569', fontWeight: '600', marginBottom: '10px', cursor: 'pointer' }}>
          <input type="checkbox" checked={joint} onChange={e => setJoint(e.target.checked)} />
          Joint report (married — both borrowers on one report)
        </label>
      )}

      {/* One drop box — drop one OR both reports; each is sorted to the right person by name */}
      {dropZone(joint
        ? 'Drop the JOINT credit report (both borrowers)'
        : coBorrowers.length > 0
          ? 'Drop credit report(s) — drop both at once, sorted by name'
          : 'Drop Credit Report PDF or Click to Browse')}

      {/* Per-person score cards */}
      {people.map(person => {
        const rep = peopleData[person.key];
        if (!rep || !(rep.scores && Object.values(rep.scores).some(Boolean))) return null;
        return scoreCard(person, rep);
      })}

      {/* Report history — every drop, newest first */}
      {(cr.history || []).length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', marginTop: '4px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Report History</div>
          {(cr.history || []).map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderTop: i ? '1px solid #f1f5f9' : 'none', fontSize: '11px' }}>
              <FileText size={13} style={{ color: '#3b82f6', flexShrink: 0 }} />
              <span style={{ flex: 1, color: '#475569' }}>{h.person || 'Report'} · {h.uploaded_at ? format(parseISO(h.uploaded_at), 'M/d/yy h:mma') : ''}</span>
              {(h.file_path || h.file_url) && (
                <button onClick={() => openReport(h)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>View</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Report Viewer Modal */}
      {signedUrl && (
        <>
          <div onClick={() => setSignedUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000 }} />
          <div style={{ position: 'fixed', top: '5%', left: '5%', right: '5%', bottom: '5%', background: '#fff', borderRadius: '12px', zIndex: 1001, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '600', color: '#1e293b' }}>Credit Report - {borrower.name}</span>
              <button onClick={() => setSignedUrl(null)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Close</button>
            </div>
            <iframe src={signedUrl} style={{ flex: 1, border: 'none' }} title="Credit Report" />
          </div>
        </>
      )}
    </div>
  );
};

// ---- Document Library (popup of all stored PDFs for the borrower) ----
const DocumentLibrary = ({ borrower }) => {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState([]);

  React.useEffect(() => { if (open) fetchDocuments(borrower.id).then(setDocs); }, [open, borrower.id]);

  const view = async (doc) => {
    const fp = doc.file_path || '';
    if (/^https?:\/\//.test(fp)) { window.open(fp, '_blank'); return; }
    try {
      const { data } = await supabase.storage.from('Documents').createSignedUrl(fp, 3600);
      if (data?.signedUrl) { window.open(data.signedUrl, '_blank'); return; }
    } catch (e) { /* fall through */ }
    if (fp) window.open(fp, '_blank');
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        style={{ background: 'none', border: 'none', color: '#1e3a5f', padding: 0, fontSize: '11px', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
        Library
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000 }} />
          <div style={{ position: 'fixed', top: '8%', left: '50%', transform: 'translateX(-50%)', width: 'min(560px, 94vw)', maxHeight: '82vh', overflowY: 'auto', background: '#fff', borderRadius: '12px', zIndex: 2001, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '14px' }}>📚 Document Library</div>
              <button onClick={() => setOpen(false)} style={{ marginLeft: 'auto', background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Close</button>
            </div>
            {docs.length === 0 && <div style={{ color: '#94a3b8', fontSize: '12px', padding: '10px 0' }}>No saved documents.</div>}
            {docs.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>
                <FileText size={15} style={{ color: '#1e3a5f', flexShrink: 0 }} />
                <div style={{ flex: 1, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                <span style={{ color: '#94a3b8', fontSize: '10px', fontFamily: 'monospace' }}>{doc.created_at ? formatDate(doc.created_at) : ''}</span>
                <button onClick={() => view(doc)} style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>View</button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
};

// ---- Credit Upgrade Plan (pop-up on the Credit Report tab) ----
const CreditUpgradeSection = ({ borrower, onUpdate }) => {
  const cr = borrower.credit_report || {};
  const upgrade = cr.upgrade || {};
  const plan = upgrade.plan || [];
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(upgrade.target_score || '');
  const [uploadingId, setUploadingId] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [lenderName, setLenderName] = useState(upgrade.lender_name || '');
  const [lenderEmail, setLenderEmail] = useState(upgrade.lender_email || '');
  const proofRef = useRef();
  const pendingRef = useRef(null);
  const lenderRef = useRef();

  const primary = cr.people?.primary || (cr.scores ? cr : null);
  const cur = (primary && primary.scores) || {};

  // Borrower first name (handles "Last, First" and "First Last")
  const fullName = (borrower.name || '').trim();
  const firstName = fullName.includes(',')
    ? (fullName.split(',')[1] || '').trim().split(/\s+/)[0]
    : fullName.split(/\s+/)[0];
  const first = firstName || 'there';
  const borrowerDisplay = fullName.includes(',')
    ? `${(fullName.split(',')[1] || '').trim()} ${(fullName.split(',')[0] || '').trim()}`.trim()
    : fullName;
  const lenderFirst = (lenderName || '').trim().split(/\s+/)[0] || 'there';

  const save = (patch) => onUpdate(borrower.id, { credit_report: { ...cr, upgrade: { ...upgrade, ...patch } } });
  const updateStep = (id, p) => save({ plan: plan.map(s => s.id === id ? { ...s, ...p } : s) });
  const removeStep = (id) => save({ plan: plan.filter(s => s.id !== id) });

  const parsePaste = async () => {
    if (!pasteText.trim()) return;
    setParsing(true);
    try {
      const r = await fetch('/api/parse-upgrade-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      });
      const d = await r.json();
      const steps = (d.steps || []).map((s, i) => ({
        id: `${Date.now()}_${i}`, text: s.text, cost: s.cost || '', done: false,
      }));
      if (!steps.length) { alert(d.error || 'Could not read a plan from that text.'); setParsing(false); return; }
      const patch = { plan: [...plan, ...steps], pasted_at: new Date().toISOString() };
      if (d.target_score && !target) { patch.target_score = d.target_score; setTarget(d.target_score); }
      if (d.lender_name) { patch.lender_name = d.lender_name; setLenderName(d.lender_name); }
      if (d.lender_email) { patch.lender_email = d.lender_email; setLenderEmail(d.lender_email); }
      save(patch);
      if (!d.lender_name && !d.lender_email) {
        setTimeout(() => { try { lenderRef.current?.focus(); } catch (e) { /* ignore */ } }, 100);
      }
      setPasteText(''); setShowPaste(false);
    } catch (e) { alert('Error reading plan: ' + e.message); }
    setParsing(false);
  };

  // Upload a proof → AI verifies it matches the step → auto-cross-off if confirmed
  const uploadProof = async (file, id) => {
    if (!file) return;
    setUploadingId(id);
    const ext = (file.name.split('.').pop() || 'pdf');
    const fileName = `proof_${borrower.id}_${id}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('Documents').upload(fileName, file);
    let proof = { proof_name: file.name };
    if (!error) { const { data } = supabase.storage.from('Documents').getPublicUrl(fileName); proof = { proof_name: file.name, proof_path: fileName, proof_url: data.publicUrl }; }

    let verified = false, note = '';
    try {
      const b64 = await fileToBase64(file);
      const r = await fetch('/api/verify-proof', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data: b64, mimeType: file.type, stepText: plan.find(s => s.id === id)?.text || '' }),
      });
      const d = await r.json();
      verified = !!d.verified; note = d.note || '';
    } catch (e) { note = 'Could not verify automatically — check it manually.'; }

    updateStep(id, { ...proof, done: verified, verify_note: note });
    setUploadingId(null);
    if (!verified) alert(`Proof uploaded, but I couldn't confirm it crosses this step off.\n\n${note || ''}\n\nIf it's correct, just tick the box yourself.`);
  };

  const viewProof = async (s) => {
    if (s.proof_path) { const { data } = await supabase.storage.from('Documents').createSignedUrl(s.proof_path, 3600); if (data?.signedUrl) window.open(data.signedUrl, '_blank'); }
    else if (s.proof_url) window.open(s.proof_url, '_blank');
  };

  const stepsList = plan.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
  const tScore = target || upgrade.target_score || 'your goal';

  const borrowerEmail =
`Hi ${first},

Great news, your free credit upgrade plan is ready :)

Here's exactly what we'll knock out together to get you to your target score of ${tScore}:

${stepsList}

As you take care of each one, just send me the proof (a receipt, a letter, a screenshot, whatever you've got) and I'll log it right away so we can re-score as soon as everything's done.

Send them along as you get them, no need to wait. Excited to get you there!

${borrower.lo_name || 'Your Loan Officer'}`;

  const borrowerSMS =
`Hi ${first}! Your free credit upgrade plan is ready :) To hit your target score of ${tScore} we'll knock out a few items:
${stepsList}
Send me proof of each as you finish so we can re-score, no need to wait. Let's go!`;

  const lenderEmailBody =
`Hi ${lenderFirst},

${borrowerDisplay || 'The borrower'} has completed all the credit upgrade items on the plan, proofs attached. We're ready to re-score.

Items completed:
${stepsList}

Thanks!`;

  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); alert(`${what} copied — paste it to your borrower.`); }
    catch (e) { alert('Could not copy automatically. Here it is:\n\n' + text); }
  };
  const saveLender = () => {
    const patch = {};
    if (lenderName !== (upgrade.lender_name || '')) patch.lender_name = lenderName;
    if (lenderEmail !== (upgrade.lender_email || '')) patch.lender_email = lenderEmail;
    if (Object.keys(patch).length) save(patch);
  };
  const emailLender = async () => {
    if (!lenderName.trim() && !lenderEmail.trim()) {
      alert("I don't have the lender contact yet. Add their name and email up top (it's right under the scores) and I'll have this ready.");
      try { lenderRef.current?.focus(); } catch (e) { /* ignore */ }
      return;
    }
    try { await navigator.clipboard.writeText(lenderEmailBody); } catch (e) { /* ignore */ }
    setShowLibrary(true);
    alert(`Lender email copied${lenderEmail ? ` (send to ${lenderEmail})` : ''}. The proof Library is open, download each one and attach it to your email.`);
  };

  const labelSm = { fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '3px' };
  const miniInput = { width: '70px', padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px' };
  const linkBtn = { background: 'none', border: '1px solid #cbd5e1', color: '#1e3a5f', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' };
  const actionBtn = { flex: 1, background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: '6px', padding: '9px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' };
  const doneCount = plan.filter(s => s.done).length;
  const complete = plan.length > 0 && doneCount === plan.length;
  const proofs = plan.filter(s => s.proof_name);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        style={{ width: '100%', marginBottom: '12px', padding: '8px 14px', borderRadius: '6px', background: '#1e3a5f', color: '#fff', border: 'none', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <span>📈 Credit Upgrade Plan{plan.length ? ` (${doneCount}/${plan.length} done)` : ''}</span>
        {upgrade.pasted_at && <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 600, opacity: 0.85 }}>added {formatDate(upgrade.pasted_at)}</span>}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000 }} />
          <div style={{ position: 'fixed', top: '6%', left: '50%', transform: 'translateX(-50%)', width: 'min(620px, 94vw)', maxHeight: '86vh', overflowY: 'auto', background: '#fff', borderRadius: '12px', zIndex: 2001, padding: '18px' }}>
            <input ref={proofRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadProof(f, pendingRef.current); if (proofRef.current) proofRef.current.value = ''; }} />
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: 800, color: '#1e3a5f', fontSize: '15px' }}>📈 Credit Upgrade Plan</div>
              <button onClick={() => setOpen(false)} style={{ marginLeft: 'auto', background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Close</button>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div>
                <div style={labelSm}>Current (EQ/EX/TU)</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', paddingTop: '4px' }}>{cur.equifax || '—'} / {cur.experian || '—'} / {cur.transunion || '—'}</div>
              </div>
              {(target || upgrade.target_score) && (
                <div>
                  <div style={labelSm}>Target Score</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e3a5f', paddingTop: '4px' }}>{target || upgrade.target_score}</div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={labelSm}>Lender contact (for re-score)</div>
              {plan.length > 0 && !lenderName && !lenderEmail && (
                <div style={{ fontSize: '11px', color: '#b45309', marginBottom: '6px' }}>I couldn't find a contact in that email. Add their name and email here so I can send the proofs when you're done.</div>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input ref={lenderRef} value={lenderName} onChange={e => setLenderName(e.target.value)} onBlur={saveLender}
                  placeholder="Contact name" style={{ flex: 1, minWidth: '130px', padding: '6px 8px', border: `1px solid ${plan.length > 0 && !lenderName && !lenderEmail ? '#f59e0b' : '#cbd5e1'}`, borderRadius: '5px', fontSize: '12px' }} />
                <input value={lenderEmail} onChange={e => setLenderEmail(e.target.value)} onBlur={saveLender}
                  placeholder="contact@email.com" style={{ flex: 1, minWidth: '160px', padding: '6px 8px', border: `1px solid ${plan.length > 0 && !lenderName && !lenderEmail ? '#f59e0b' : '#cbd5e1'}`, borderRadius: '5px', fontSize: '12px' }} />
              </div>
            </div>

            {complete && (
              <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', color: '#065f46', fontSize: '13px', fontWeight: 700 }}>
                ✅ All steps complete! Ready to re-score{lenderName ? `, send the proofs to ${lenderName}` : ''}.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <div style={labelSm}>Game Plan</div>
              <button onClick={() => setShowPaste(v => !v)} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #1e3a5f', color: '#1e3a5f', borderRadius: '5px', padding: '3px 10px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                📋 Paste plan from email
              </button>
            </div>
            {showPaste && (
              <div style={{ marginBottom: '12px' }}>
                <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={6}
                  placeholder="Paste the upgrade plan email here — AI will turn it into checkable steps…"
                  style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box' }} />
                <button onClick={parsePaste} disabled={parsing || !pasteText.trim()}
                  style={{ marginTop: '6px', background: parsing ? '#94a3b8' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: '5px', padding: '7px 16px', fontWeight: 700, cursor: parsing ? 'default' : 'pointer', fontSize: '12px' }}>
                  {parsing ? 'Reading…' : '✨ Read into steps'}
                </button>
              </div>
            )}
            {plan.length === 0 && <div style={{ color: '#94a3b8', fontSize: '12px', padding: '8px 0' }}>No steps yet — paste the upgrade email above to build the plan.</div>}
            {plan.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 0', borderTop: i ? '1px solid #f1f5f9' : 'none' }}>
                <input type="checkbox" checked={!!s.done} onChange={e => updateStep(s.id, { done: e.target.checked })} style={{ marginTop: '3px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: '#1e293b', textDecoration: s.done ? 'line-through' : 'none' }}>{i + 1}. {s.text}</div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input value={s.cost || ''} onChange={e => updateStep(s.id, { cost: e.target.value })} placeholder="cost $" style={miniInput} />
                    {s.proof_name
                      ? <button onClick={() => viewProof(s)} style={{ ...linkBtn, borderColor: s.done ? '#6ee7b7' : '#cbd5e1', color: s.done ? '#059669' : '#1e3a5f' }}>📎 {s.done ? 'verified' : 'proof'}</button>
                      : <button onClick={() => { pendingRef.current = s.id; proofRef.current?.click(); }} style={linkBtn}>{uploadingId === s.id ? 'verifying…' : 'upload proof'}</button>}
                    {s.proof_name && !s.done && <span style={{ fontSize: '10px', color: '#dc2626' }}>not confirmed</span>}
                  </div>
                </div>
                <button onClick={() => removeStep(s.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}><X size={14} /></button>
              </div>
            ))}

            {plan.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                <button onClick={() => copy(borrowerEmail, 'Email')} style={actionBtn}>📧 Copy Email</button>
                <button onClick={() => copy(borrowerSMS, 'SMS')} style={actionBtn}>💬 Copy SMS</button>
                <button onClick={() => setShowLibrary(true)} style={{ ...actionBtn, background: 'none', border: '1px solid #1e3a5f', color: '#1e3a5f' }}>📚 Library{proofs.length ? ` (${proofs.length})` : ''}</button>
                {complete && <button onClick={emailLender} style={{ ...actionBtn, background: '#059669' }}>📧 Email Lender</button>}
              </div>
            )}
          </div>

          {showLibrary && (
            <>
              <div onClick={() => setShowLibrary(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2002 }} />
              <div style={{ position: 'fixed', top: '12%', left: '50%', transform: 'translateX(-50%)', width: 'min(520px, 92vw)', maxHeight: '76vh', overflowY: 'auto', background: '#fff', borderRadius: '12px', zIndex: 2003, padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 800, color: '#1e3a5f', fontSize: '14px' }}>📚 Proof Library</div>
                  <button onClick={() => setShowLibrary(false)} style={{ marginLeft: 'auto', background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Close</button>
                </div>
                {proofs.length === 0 && <div style={{ color: '#94a3b8', fontSize: '12px', padding: '8px 0' }}>No proofs uploaded yet.</div>}
                {proofs.map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderTop: i ? '1px solid #f1f5f9' : 'none', fontSize: '12px' }}>
                    {s.done ? <span style={{ color: '#059669' }}>✓</span> : <span style={{ color: '#dc2626' }}>•</span>}
                    <div style={{ flex: 1, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.text}</div>
                    <button onClick={() => viewProof(s)} style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>View</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
};

// ---- Income/Employment Section ----
const IncomeSection = ({ borrower, onUpdate }) => {
  const incomes = borrower.incomes || [];
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ person: 'Borrower', employment_type: 'Employment', income_type: '', employer: '', gross_monthly: '', pay_frequency: 'Monthly' });

  const personOptions = ['Borrower'];
  const allCoBorrowers = borrower.co_borrowers?.length ? borrower.co_borrowers : (borrower.co_borrower ? [borrower.co_borrower] : []);
  allCoBorrowers.forEach((cb, i) => personOptions.push(`Co-Borrower ${i + 1} (${cb})`));
  if (allCoBorrowers.length === 0) personOptions.push('Co-Borrower');

  const saveIncome = async () => {
    try {
      const updated = [...incomes, { ...form, id: Date.now() }];
      await onUpdate(borrower.id, { incomes: updated });
      setForm({ person: 'Borrower', employment_type: 'Employment', income_type: '', employer: '', gross_monthly: '', pay_frequency: 'Monthly' });
      setAdding(false);
    } catch (e) {
      console.error('Save income error:', e);
      alert('Failed to save income: ' + e.message);
    }
  };

  const removeIncome = async (id) => {
    const updated = incomes.filter(i => i.id !== id);
    await onUpdate(borrower.id, { incomes: updated });
  };

  const fieldStyle = { padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', width: '100%' };
  const labelStyle = { fontSize: '10px', color: '#64748b', marginBottom: '2px' };

  const incomeCalc = incomes.map(inc => ({ inc, ...calcMonthlyIncome(inc) }));
  const totalMonthly = incomeCalc.reduce((s, x) => s + (x.monthly || 0), 0);

  return (
    <div>
      {incomes.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '2px solid #10b981', borderRadius: '10px', padding: '14px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(16,185,129,0.18)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Monthly Qualifying</div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>estimate — verify vs guidelines</div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '900', color: '#047857', lineHeight: 1 }}>
              ${Math.round(totalMonthly).toLocaleString()}<span style={{ fontSize: '14px', fontWeight: '700' }}>/mo</span>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #6ee7b7', paddingTop: '8px' }}>
            {incomeCalc.map((x, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '12px', padding: '3px 0', color: '#1e293b' }}>
                <span>{x.inc.person || 'Borrower'}{x.inc.employer ? ` — ${x.inc.employer}` : ''} <span style={{ color: '#64748b', fontSize: '10px' }}>({x.method})</span></span>
                <span style={{ fontWeight: '700' }}>${Math.round(x.monthly).toLocaleString()}/mo</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>INCOME ENTRIES</span>
        <button type="button" onClick={() => setAdding(a => !a)}
          style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
          + Add Income
        </button>
      </div>

      {incomes.map(inc => (
        <div key={inc.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ fontWeight: '600', fontSize: '12px', color: '#0d9488' }}>{inc.person} — {inc.employment_type}</div>
            <button onClick={() => removeIncome(inc.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}><X size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px' }}>
            {inc.income_type && <div><span style={{ color: '#64748b' }}>Type:</span> {inc.income_type}</div>}
            {inc.employer && <div><span style={{ color: '#64748b' }}>Employer:</span> {inc.employer}</div>}
            {inc.gross_monthly && <div><span style={{ color: '#64748b' }}>Gross Monthly:</span> ${Number(inc.gross_monthly).toLocaleString()}</div>}
            {inc.pay_frequency && <div><span style={{ color: '#64748b' }}>Pay Freq:</span> {inc.pay_frequency}</div>}
          </div>
        </div>
      ))}

      {adding && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <div style={labelStyle}>Person</div>
              <select value={form.person} onChange={e => setForm(f => ({ ...f, person: e.target.value }))} style={fieldStyle}>
                {personOptions.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Employment Type</div>
              <select value={form.employment_type} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))} style={fieldStyle}>
                {EMPLOYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Income Type</div>
              <select value={form.income_type} onChange={e => setForm(f => ({ ...f, income_type: e.target.value }))} style={fieldStyle}>
                <option value="">Select...</option>
                {INCOME_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Employer/Source</div>
              <input type="text" value={form.employer} onChange={e => setForm(f => ({ ...f, employer: e.target.value }))} style={fieldStyle} placeholder="Company name..." />
            </div>
            <div>
              <div style={labelStyle}>Gross Monthly</div>
              <input type="number" value={form.gross_monthly} onChange={e => setForm(f => ({ ...f, gross_monthly: e.target.value }))} style={fieldStyle} placeholder="$0.00" />
            </div>
            <div>
              <div style={labelStyle}>Pay Frequency</div>
              <select value={form.pay_frequency} onChange={e => setForm(f => ({ ...f, pay_frequency: e.target.value }))} style={fieldStyle}>
                <option>Monthly</option>
                <option>Bi-Weekly</option>
                <option>Weekly</option>
                <option>Semi-Monthly</option>
                <option>Annual</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={saveIncome} style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Save</button>
            <button onClick={() => setAdding(false)} style={{ background: '#e2e8f0', color: '#475569', border: 'none', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

const AppraisalSection = ({ borrower, onUpdate }) => {
  const [value, setValue] = useState(borrower.appraisal_value || '');
  const [waiver, setWaiver] = useState(borrower.appraisal_waiver || false);
  const [waiverReason, setWaiverReason] = useState(borrower.appraisal_waiver_reason || '');
  const [appraisalType, setAppraisalType] = useState(borrower.appraisal_type || '');
  const [subjectTo, setSubjectTo] = useState(borrower.appraisal_subject_to || '');
  const [reinspection, setReinspection] = useState(borrower.appraisal_reinspection || false);
  const [reinspectionDate, setReinspectionDate] = useState(borrower.appraisal_reinspection_date || '');

  return (
    <div>
      {/* Appraisal Type Dropdown */}
      <div style={{ marginBottom: '12px' }}>
        <select
          value={appraisalType}
          onChange={e => { setAppraisalType(e.target.value); onUpdate(borrower.id, { appraisal_type: e.target.value }); }}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff', color: '#1e293b' }}
        >
          <option value="">Select Appraisal Type...</option>
          {APPRAISAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div className="loan-field" style={{ minWidth: '140px' }}>
          <label style={{ color: '#1e293b', fontSize: '11px', fontWeight: '600' }}>Appraised Value</label>
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={() => onUpdate(borrower.id, { appraisal_value: value || null })}
            placeholder="450000"
            style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '6px 8px', borderRadius: '4px', fontSize: '12px' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
          <input type="checkbox" id={`waiver-${borrower.id}`} checked={waiver} onChange={e => {
            setWaiver(e.target.checked);
            onUpdate(borrower.id, { appraisal_waiver: e.target.checked });
          }} />
          <label htmlFor={`waiver-${borrower.id}`} style={{ fontSize: '12px', cursor: 'pointer', color: '#1e293b' }}>Appraisal Waiver (PIW)</label>
        </div>
      </div>

      {waiver && (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ color: '#1e293b', fontSize: '11px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>AUS Waiver Reason</label>
          <input
            type="text"
            value={waiverReason}
            onChange={e => setWaiverReason(e.target.value)}
            onBlur={() => onUpdate(borrower.id, { appraisal_waiver_reason: waiverReason })}
            placeholder="AUS approval reason…"
            style={{ width: '100%', background: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '6px 8px', borderRadius: '4px', fontSize: '12px' }}
          />
        </div>
      )}

      {/* Subject To */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ color: '#1e293b', fontSize: '11px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Subject To (conditions/repairs)</label>
        <textarea
          value={subjectTo}
          onChange={e => setSubjectTo(e.target.value)}
          onBlur={() => onUpdate(borrower.id, { appraisal_subject_to: subjectTo })}
          placeholder="Any conditions or repairs required..."
          rows={2}
          style={{ width: '100%', background: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', resize: 'vertical' }}
        />
      </div>

      {/* Reinspection */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" id={`reinspect-${borrower.id}`} checked={reinspection} onChange={e => {
            setReinspection(e.target.checked);
            onUpdate(borrower.id, { appraisal_reinspection: e.target.checked });
          }} />
          <label htmlFor={`reinspect-${borrower.id}`} style={{ fontSize: '12px', cursor: 'pointer', color: '#1e293b' }}>Reinspection Required</label>
        </div>
        {reinspection && (
          <div>
            <label style={{ color: '#1e293b', fontSize: '11px', fontWeight: '600', marginRight: '6px' }}>Completed:</label>
            <input
              type="date"
              value={reinspectionDate}
              onChange={e => { setReinspectionDate(e.target.value); onUpdate(borrower.id, { appraisal_reinspection_date: e.target.value }); }}
              style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
            />
          </div>
        )}
      </div>

      {borrower.appraisal_value && (
        <div style={{ marginTop: '12px' }}>
          <span style={{ background: '#dcfce7', color: '#14532d', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
            ✅ {formatCurrency(borrower.appraisal_value)}
          </span>
        </div>
      )}
    </div>
  );
};

// ---- Main Expanded Card ----
const ExpandedCard = ({ borrower, ops, onClose, defaultTab }) => {
  const [openTabs, setOpenTabs] = useState(new Set([defaultTab || 'notes']));
  const [maxTab, setMaxTab] = useState(null);
  const [contactsExpanded, setContactsExpanded] = useState(false);
  const hasFullDetails = STAGES_WITH_FULL_DETAILS.includes(borrower.stage);

  const toggleTab = (id) => {
    setOpenTabs(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const closeTab = (id) => {
    setOpenTabs(prev => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const tabs = [
    { id: 'notes',    label: 'NOTES' },
    { id: 'tasks',    label: 'TASKS' },
    { id: 'bonzonotes', label: 'BONZO NOTES' },
    { id: 'comms',    label: 'COMMUNICATION' },
    { id: 'docs',     label: 'DOCUMENTS' },
    { id: 'borrowers', label: 'BORROWERS' },
    { id: 'credit',   label: 'CREDIT REPORT' },
    { id: 'income',   label: 'INCOME' },
    { id: 'needs',    label: 'NEEDS' },
    { id: 'terms',    label: 'LOAN TERMS' },
    { id: 'contacts', label: 'CONTACTS' },
    { id: 'contingencies', label: 'CONTINGENCIES' },
    { id: 'appraisal', label: 'APPRAISAL' },
    { id: 'preapproval', label: 'PREAPPROVAL' },
    { id: 'calc',     label: 'CALC' },
    { id: 'subhub',   label: 'SUB HUB' },
    { id: 'getpaid',  label: 'GET PAID' },
    { id: 'history',  label: 'HISTORY' },
    { id: 'notifyloa', label: 'NOTIFY LOA' },
  ];

  const boxStyle = { position: 'relative', background: '#f1f5f9', borderRadius: '8px', padding: '16px', border: '2px solid #0d9488', width: '500px', flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: '400px' };
  // Full-size (maximized) version of a tab box
  const maxBoxStyle = { position: 'fixed', inset: '10px', width: 'auto', zIndex: 1600, overflowY: 'auto', background: '#f1f5f9', borderRadius: '8px', padding: '20px', border: '2px solid #0d9488', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.45)' };
  const tabBoxStyle = (id) => (maxTab === id ? maxBoxStyle : boxStyle);
  // Expand / restore button for the top-right of a tab box
  const maxBtn = (id) => (
    <button type="button" onClick={() => setMaxTab(m => (m === id ? null : id))}
      title={maxTab === id ? 'Restore to normal size' : 'Expand to full size'}
      style={{ position: 'absolute', top: '10px', right: '12px', background: '#fff', border: '1px solid #94a3b8', borderRadius: '4px', color: '#475569', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '3px 7px', zIndex: 3 }}>
      {maxTab === id ? '🗗' : '⛶'}
    </button>
  );
  const closeBtn = (id) => (
    <div style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '12px' }}>
      <button type="button" onClick={() => closeTab(id)}
        style={{ background: '#64748b', color: '#fff', border: 'none', padding: '4px 16px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
        Close
      </button>
    </div>
  );

  return (
    <div className="expanded-card">
      {/* Tabs Row */}
      <div className="expanded-tabs">
        {tabs.map(t => (
          <button key={t.id} type="button" className={`expanded-tab ${openTabs.has(t.id) ? 'active' : ''}`} onClick={() => toggleTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content Boxes */}
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
        {openTabs.has('notes') && (
          <div style={{ ...boxStyle, minHeight: '320px', height: 'min(550px, 72vh)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <NotesSection borrower={borrower} ops={ops} onClose={onClose} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', paddingTop: '12px', flexShrink: 0 }}>
              {borrower.bonzo_id && (
                <button type="button" onClick={() => toggleTab('bonzonotes')}
                  style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                  View Bonzo Notes
                </button>
              )}
              <button type="button" onClick={() => closeTab('notes')}
                style={{ background: '#64748b', color: '#fff', border: 'none', padding: '4px 16px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        )}

        {openTabs.has('tasks') && (
          <div style={boxStyle}>
            <TasksSection borrower={borrower} ops={ops} />
            {closeBtn('tasks')}
          </div>
        )}

        {openTabs.has('bonzonotes') && (
          <div style={{ ...boxStyle, background: '#1e3a5f', border: '2px solid #3b82f6' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#60a5fa', marginBottom: '12px' }}>📘 Bonzo Notes</div>
            <BonzoNotesSection borrower={borrower} />
            {closeBtn('bonzonotes')}
          </div>
        )}

        {openTabs.has('comms') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>💬 Communication</div>
            <CommunicationSection borrower={borrower} onLinked={ops?.refetch} />
            {closeBtn('comms')}
          </div>
        )}

        {openTabs.has('docs') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>📄 Upload Documents</div>
            <DocDropZone borrower={borrower} onDocAdded={() => ops.refetch()} ops={ops} />
            {closeBtn('docs')}
          </div>
        )}

        {openTabs.has('needs') && (
          <div style={{ ...boxStyle, width: '500px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>📋 Needs List</div>
            <NeedsSection borrower={borrower} ops={ops} />
            {closeBtn('needs')}
          </div>
        )}

        {openTabs.has('borrowers') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>👤 Borrowers</div>
            <div style={{ marginBottom: '16px' }}>
              <DocDropZone borrower={borrower} ops={ops} onDocAdded={() => ops.refetch()} compact label="📎 Drop 1003 / AUS to auto-fill" />
            </div>
            <BorrowersSection borrower={borrower} onUpdate={ops.updateBorrower} />
            {closeBtn('borrowers')}
          </div>
        )}

        {openTabs.has('terms') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>💰 Loan Terms</div>
            <div style={{ marginBottom: '16px' }}>
              <DocDropZone borrower={borrower} ops={ops} onDocAdded={() => ops.refetch()} compact label="📎 Drop docs to auto-fill loan terms" />
            </div>
            <LoanTermsGrid borrower={borrower} onUpdate={ops.updateBorrower} />
            {closeBtn('terms')}
          </div>
        )}

        {openTabs.has('income') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>💵 Income / Employment</div>
            <div style={{ marginBottom: '16px' }}>
              <DocDropZone borrower={borrower} ops={ops} onDocAdded={() => ops.refetch()} compact label="📎 Drop paystub / W-2 / tax returns" />
            </div>
            <IncomeSection borrower={borrower} onUpdate={ops.updateBorrower} />
            {closeBtn('income')}
          </div>
        )}

        {openTabs.has('contacts') && (
          <div style={boxStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>👥 Contacts</div>
              <button type="button" onClick={() => setContactsExpanded(e => !e)}
                style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>
                {contactsExpanded ? 'Collapse' : 'View Card'}
              </button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <DocDropZone borrower={borrower} ops={ops} onDocAdded={() => ops.refetch()} compact label="📎 Drop Purchase Agreement to fill contacts" />
            </div>
            {contactsExpanded ? (
              <ContactsCard borrower={borrower} ops={ops} />
            ) : (
              CONTACT_ROLES.map(r => (
                <ContactAccordion key={r.value} borrower={borrower} role={r.value} ops={ops} />
              ))
            )}
            {closeBtn('contacts')}
          </div>
        )}

        {openTabs.has('contingencies') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>⚠️ Contingencies</div>
            <div style={{ marginBottom: '16px' }}>
              <DocDropZone borrower={borrower} ops={ops} onDocAdded={() => ops.refetch()} compact label="📎 Drop Purchase Agreement" />
            </div>

            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e3a5f', marginBottom: '8px', textTransform: 'uppercase' }}>📋 Purchase Agreement</div>
            <PASection borrower={borrower} ops={ops} />

            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e3a5f', margin: '18px 0 8px', textTransform: 'uppercase' }}>🔄 Counters</div>
            <CountersSection borrower={borrower} ops={ops} />

            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e3a5f', margin: '18px 0 8px', textTransform: 'uppercase' }}>⚠️ Contingency Dates</div>
            <ContingenciesSection borrower={borrower} ops={ops} />
            {closeBtn('contingencies')}
          </div>
        )}

        {openTabs.has('credit') && (
          <div style={tabBoxStyle('credit')}>
            {maxBtn('credit')}
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>📊 Credit Report</div>
            <CreditUpgradeSection borrower={borrower} onUpdate={ops.updateBorrower} />
            <CreditReportSection borrower={borrower} onUpdate={ops.updateBorrower} ops={ops} />
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', paddingTop: '12px' }}>
              <div style={{ flex: 1 }}><DocumentLibrary borrower={borrower} /></div>
              <button type="button" onClick={() => closeTab('credit')}
                style={{ background: '#64748b', color: '#fff', border: 'none', padding: '4px 16px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                Close
              </button>
              <div style={{ flex: 1 }} />
            </div>
          </div>
        )}

        {openTabs.has('appraisal') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>
              🏠 Appraisal {borrower.appraisal_type && <span style={{ fontWeight: '400', color: '#1e293b' }}>— {borrower.appraisal_type}</span>}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <DocDropZone borrower={borrower} ops={ops} onDocAdded={() => ops.refetch()} compact label="📎 Drop Appraisal" />
            </div>
            <AppraisalSection borrower={borrower} onUpdate={ops.updateBorrower} />
            {closeBtn('appraisal')}
          </div>
        )}

        {openTabs.has('preapproval') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>✅ Preapproval</div>
            <PreapprovalSection borrower={borrower} onUpdate={ops.updateBorrower} />
            {closeBtn('preapproval')}
          </div>
        )}

        {openTabs.has('history') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>📜 History</div>
            <StageHistory borrowerId={borrower.id} />
            {closeBtn('history')}
          </div>
        )}

        {openTabs.has('calc') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>Calculators</div>
            <CalcSection borrower={borrower} />
            {closeBtn('calc')}
          </div>
        )}

        {openTabs.has('subhub') && (
          <div style={{ ...boxStyle, border: '2px solid #3b82f6' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>SUB HUB - Submit to Processing</div>
            <SubHubSection borrower={borrower} onUpdate={ops.updateBorrower} ops={ops} />
            {closeBtn('subhub')}
          </div>
        )}

        {openTabs.has('getpaid') && (
          <div style={{ ...boxStyle, border: borrower.funded_date ? '2px solid #10b981' : '2px solid #f59e0b' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>GET PAID - Funded Stage</div>
            <GetPaidSection borrower={borrower} onUpdate={ops.updateBorrower} />
            {closeBtn('getpaid')}
          </div>
        )}

        {openTabs.has('notifyloa') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>📣 Notify LOA</div>
            <NotifyLOASection borrower={borrower} />
            {closeBtn('notifyloa')}
          </div>
        )}
      </div>
      {/* Close borrower button */}
      {onClose && (
        <div style={{ textAlign: 'center', paddingTop: '12px', borderTop: '1px solid #3a454f', marginTop: '12px' }}>
          <button type="button" onClick={onClose}
            style={{ background: '#4a5660', color: '#e8eaed', border: 'none', padding: '6px 20px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default ExpandedCard;
