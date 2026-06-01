import React, { useState, useRef, useCallback } from 'react';
import { Plus, X, Check, ChevronDown, ChevronRight, FileText, Upload } from 'lucide-react';
import { STAGES_WITH_FULL_DETAILS, CONTACT_ROLES } from '../lib/constants';
import { formatDate, formatCurrency, formatRate, calcPI, calcLTV, taskUrgency, urgencyColor } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { claudeService } from '../lib/claude';
import { format, parseISO } from 'date-fns';

// ---- Notes Section ----
const NotesSection = ({ borrower, onUpdate }) => {
  const [notes, setNotes] = useState(borrower.notes || '');
  const timerRef = useRef();

  const handleChange = (val) => {
    setNotes(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onUpdate(borrower.id, { notes: val }), 800);
  };

  return (
    <div>
      <div className="section-heading">📝 Notes</div>
      <textarea
        className="notes-area"
        value={notes}
        onChange={e => handleChange(e.target.value)}
        placeholder="Notes auto-save as you type…"
      />
    </div>
  );
};

// ---- Tasks Section ----
const TasksSection = ({ borrower, ops }) => {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', due_date: '', type: 'task', assigned_to: '' });

  const tasks = (borrower.tasks || []).sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  });

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    await ops.addTask({ ...form, borrower_id: borrower.id });
    setForm({ title: '', due_date: '', type: 'task', assigned_to: '' });
    setAdding(false);
  };

  return (
    <div>
      <div className="section-heading">
        ✅ Tasks & Appointments
        <button type="button" className="btn-xs btn-ghost" onClick={() => setAdding(a => !a)} style={{ marginLeft: 'auto' }}>
          <Plus size={10} /> Add
        </button>
      </div>

      {tasks.map(task => {
        const urgency = task.type === 'appointment' ? 'appointment' : (task.completed ? 'completed' : taskUrgency(task.due_date));
        const colors = urgency === 'appointment'
          ? { color: '#1e3a8a', bg: '#dbeafe' }
          : urgency === 'completed'
          ? { color: '#6a6a80', bg: '#22222e' }
          : urgencyColor(urgency);

        return (
          <div key={task.id} className={`task-item ${urgency}`} style={{ background: colors.bg, color: colors.color }}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => ops.updateTask(task.id, { completed: !task.completed })}
              style={{ accentColor: colors.color, flexShrink: 0 }}
            />
            <span style={{ flex: 1, textDecoration: task.completed ? 'line-through' : 'none' }}>
              {task.type === 'appointment' ? '📅 ' : ''}{task.title}
            </span>
            {task.due_date && (
              <span style={{ fontSize: '10px', fontFamily: 'Space Mono, monospace', flexShrink: 0 }}>
                {format(typeof task.due_date === 'string' ? parseISO(task.due_date) : task.due_date, 'M/d h:mma')}
              </span>
            )}
            {task.assigned_to && <span style={{ fontSize: '10px', opacity: 0.7 }}>{task.assigned_to}</span>}
            <button type="button" onClick={() => ops.deleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}>
              <X size={12} />
            </button>
          </div>
        );
      })}

      {adding && (
        <div style={{ background: '#22222e', border: '1px solid #333345', borderRadius: '6px', padding: '10px', marginTop: '6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              style={{ background: '#1a1a23', border: '1px solid #333345', color: '#e8e8f0', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
            >
              <option value="task">Task</option>
              <option value="appointment">Appointment</option>
            </select>
            <input
              type="datetime-local"
              value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              style={{ background: '#1a1a23', border: '1px solid #333345', color: '#e8e8f0', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
            />
          </div>
          <input
            type="text"
            placeholder="Title / description…"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{ width: '100%', background: '#1a1a23', border: '1px solid #333345', color: '#e8e8f0', padding: '5px 8px', borderRadius: '4px', fontSize: '12px', marginBottom: '6px', outline: 'none' }}
          />
          <input
            type="text"
            placeholder="Assign to (LO / LOA name)"
            value={form.assigned_to}
            onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
            style={{ width: '100%', background: '#1a1a23', border: '1px solid #333345', color: '#e8e8f0', padding: '5px 8px', borderRadius: '4px', fontSize: '12px', marginBottom: '8px', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleAdd}>Save</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---- Document Drop Zone ----
const DocDropZone = ({ borrower, onDocAdded }) => {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [docs, setDocs] = useState([]);
  const [showDocs, setShowDocs] = useState(false);
  const inputRef = useRef();

  const loadDocs = useCallback(async () => {
    const { data } = await supabase.from('documents').select('*').eq('borrower_id', borrower.id).order('created_at', { ascending: false });
    setDocs(data || []);
  }, [borrower.id]);

  React.useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleFile = async (file) => {
    setUploading(true);
    setStatus('Uploading…');
    try {
      // Upload to Supabase storage
      const path = `${borrower.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);

      // AI analysis
      setStatus('AI analyzing…');
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(',')[1];
        const mimeType = file.type || 'application/pdf';
        
        let aiSummary = '';
        let extracted = {};
        try {
          const result = await claudeService.analyzeDocument(base64, mimeType, file.name);
          aiSummary = result.summary;
          extracted = result.extracted;
        } catch (e) {
          aiSummary = 'AI analysis unavailable';
        }

        // Save doc record
        await supabase.from('documents').insert([{
          borrower_id: borrower.id,
          name: file.name,
          file_path: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          ai_summary: aiSummary,
        }]);

        // Append summary to notes
        if (aiSummary) {
          const currentNotes = borrower.notes || '';
          const newNote = `\n\n📄 ${file.name} (${new Date().toLocaleDateString()}):\n${aiSummary}`;
          await supabase.from('borrowers').update({ notes: currentNotes + newNote }).eq('id', borrower.id);
        }

        // Auto-fill extracted fields
        if (Object.keys(extracted).length > 0) {
          const updates = {};
          if (extracted.purchase_price) updates.purchase_price = extracted.purchase_price;
          if (extracted.coe_date) updates.coe_date = extracted.coe_date;
          if (extracted.dti) updates.dti = extracted.dti;
          if (extracted.ltv) updates.ltv = extracted.ltv;
          if (Object.keys(updates).length > 0) {
            await supabase.from('borrowers').update(updates).eq('id', borrower.id);
          }
        }

        setStatus(`✅ ${file.name} analyzed`);
        loadDocs();
        if (onDocAdded) onDocAdded();
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setStatus(`❌ Error: ${e.message}`);
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <div className="section-heading">
        📎 Documents
        <button type="button" className="btn-xs btn-ghost" onClick={() => setShowDocs(s => !s)} style={{ marginLeft: 'auto' }}>
          {showDocs ? 'Hide' : `Show (${docs.length})`}
        </button>
      </div>

      <div
        className={`doc-zone ${dragging ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? status : (
          <>
            <Upload size={20} style={{ marginBottom: '6px', opacity: 0.5 }} />
            <div style={{ fontWeight: '500', marginBottom: '2px' }}>Drop PDF or image here</div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>Pay stubs · Bank statements · Tax returns · AUS · Appraisal · PA</div>
            <div style={{ fontSize: '11px', color: '#9f67f7', marginTop: '4px' }}>AI reads and extracts key data automatically</div>
          </>
        )}
      </div>

      {status && !uploading && (
        <div style={{ fontSize: '11px', color: status.startsWith('✅') ? '#16a34a' : '#dc2626', marginBottom: '8px' }}>
          {status}
        </div>
      )}

      <input ref={inputRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />

      {showDocs && docs.length > 0 && (
        <div style={{ background: '#22222e', borderRadius: '5px', padding: '8px', marginTop: '6px' }}>
          {docs.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '5px 0', borderBottom: '1px solid #333345', fontSize: '11px' }}>
              <FileText size={12} style={{ color: '#6a6a80', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <a href={doc.file_path} target="_blank" rel="noopener noreferrer" style={{ color: '#9f67f7', textDecoration: 'none', fontWeight: '500' }}>
                  {doc.name}
                </a>
                {doc.ai_summary && (
                  <div style={{ color: '#a0a0b8', marginTop: '2px', lineHeight: 1.4 }}>{doc.ai_summary}</div>
                )}
              </div>
              <span style={{ color: '#6a6a80', flexShrink: 0 }}>{formatDate(doc.created_at)}</span>
            </div>
          ))}
        </div>
      )}
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

// ---- Contingencies (for Lip's, Funded, LP Ready, Paycom) ----
const ContingenciesSection = ({ borrower, ops }) => {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');

  const contingencies = borrower.contingencies || [];

  return (
    <div>
      <div className="section-heading">
        ⚠️ Contingencies
        <button type="button" className="btn-xs btn-ghost" onClick={() => setAdding(a => !a)} style={{ marginLeft: 'auto' }}>
          <Plus size={10} /> Add
        </button>
      </div>

      {contingencies.map(c => (
        <div key={c.id} className="contingency-item">
          <input type="checkbox" checked={c.completed} onChange={() => ops.toggleContingency(c.id, !c.completed)} />
          <span style={{ flex: 1, textDecoration: c.completed ? 'line-through' : 'none', color: c.completed ? '#6a6a80' : '#e8e8f0' }}>
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

// ---- Stipulations ----
const StipulationsSection = ({ borrower, ops }) => {
  const [newItem, setNewItem] = useState('');
  const stips = borrower.stipulations || [];

  return (
    <div>
      <div className="section-heading">📋 Stipulations / Needs List</div>
      {stips.map(s => (
        <div key={s.id} className={`stip-item ${s.received ? 'received' : ''}`}>
          <span style={{ flex: 1 }}>{s.item}</span>
          {s.received ? (
            <span style={{ fontSize: '10px', color: '#16a34a' }}>✅ {s.received_date ? formatDate(s.received_date) : 'Received'}</span>
          ) : (
            <button type="button" className="btn-xs btn-ghost" onClick={() => ops.markStipReceived(s.id, null)} style={{ color: '#16a34a', borderColor: '#16a34a' }}>
              Got it
            </button>
          )}
          <button type="button" onClick={() => ops.removeStipulation(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
            <X size={12} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
        <input
          type="text"
          placeholder="Add stipulation…"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newItem.trim()) { ops.addStipulation(borrower.id, newItem.trim()); setNewItem(''); } }}
          style={{ flex: 1, background: '#1a1a23', border: '1px solid #333345', color: '#e8e8f0', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (newItem.trim()) { ops.addStipulation(borrower.id, newItem.trim()); setNewItem(''); } }}>
          Add
        </button>
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
      </div>
    </div>
  );
};

// ---- Appraisal Section ----
const AppraisalSection = ({ borrower, onUpdate }) => {
  const [value, setValue] = useState(borrower.appraisal_value || '');
  const [waiver, setWaiver] = useState(borrower.appraisal_waiver || false);
  const [waiverReason, setWaiverReason] = useState(borrower.appraisal_waiver_reason || '');

  return (
    <div>
      <div className="section-heading">🏠 Appraisal</div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="loan-field" style={{ minWidth: '140px' }}>
          <label>Appraised Value</label>
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={() => onUpdate(borrower.id, { appraisal_value: value || null })}
            placeholder="450000"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
          <input type="checkbox" id={`waiver-${borrower.id}`} checked={waiver} onChange={e => {
            setWaiver(e.target.checked);
            onUpdate(borrower.id, { appraisal_waiver: e.target.checked });
          }} />
          <label htmlFor={`waiver-${borrower.id}`} style={{ fontSize: '12px', cursor: 'pointer' }}>Appraisal Waiver</label>
        </div>
        {waiver && (
          <div className="loan-field" style={{ flex: 1, minWidth: '160px' }}>
            <label>AUS Waiver Reason</label>
            <input
              type="text"
              value={waiverReason}
              onChange={e => setWaiverReason(e.target.value)}
              onBlur={() => onUpdate(borrower.id, { appraisal_waiver_reason: waiverReason })}
              placeholder="AUS approval reason…"
            />
          </div>
        )}
        {borrower.appraisal_value && (
          <div style={{ paddingTop: '20px' }}>
            <span style={{ background: '#dcfce7', color: '#14532d', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
              ✅ {formatCurrency(borrower.appraisal_value)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ---- Main Expanded Card ----
const ExpandedCard = ({ borrower, ops }) => {
  const [tab, setTab] = useState('notes');
  const hasFullDetails = STAGES_WITH_FULL_DETAILS.includes(borrower.stage);

  const tabs = [
    { id: 'notes',    label: 'Notes & Tasks' },
    { id: 'docs',     label: 'Documents' },
    ...(hasFullDetails ? [
      { id: 'terms',  label: 'Loan Terms' },
      { id: 'contacts', label: 'Contacts' },
      { id: 'stips',  label: 'Stipulations' },
      { id: 'contingencies', label: 'Contingencies' },
      { id: 'appraisal', label: 'Appraisal' },
    ] : []),
    { id: 'history',  label: 'History' },
  ];

  return (
    <div className="expanded-card">
      <div className="expanded-tabs">
        {tabs.map(t => (
          <button key={t.id} type="button" className={`expanded-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'notes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <NotesSection borrower={borrower} onUpdate={ops.updateBorrower} />
            <TasksSection borrower={borrower} ops={ops} />
          </div>
        )}

        {tab === 'docs' && (
          <DocDropZone borrower={borrower} onDocAdded={() => ops.refetch()} />
        )}

        {tab === 'terms' && hasFullDetails && (
          <LoanTermsGrid borrower={borrower} onUpdate={ops.updateBorrower} />
        )}

        {tab === 'contacts' && hasFullDetails && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {CONTACT_ROLES.map(r => (
              <ContactAccordion key={r.value} borrower={borrower} role={r.value} ops={ops} />
            ))}
          </div>
        )}

        {tab === 'stips' && hasFullDetails && (
          <StipulationsSection borrower={borrower} ops={ops} />
        )}

        {tab === 'contingencies' && hasFullDetails && (
          <ContingenciesSection borrower={borrower} ops={ops} />
        )}

        {tab === 'appraisal' && hasFullDetails && (
          <AppraisalSection borrower={borrower} onUpdate={ops.updateBorrower} />
        )}

        {tab === 'history' && (
          <StageHistory borrowerId={borrower.id} />
        )}
      </div>
    </div>
  );
};

export default ExpandedCard;
