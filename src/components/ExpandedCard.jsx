import React, { useState, useRef, useCallback } from 'react';
import { Plus, X, Check, ChevronDown, ChevronRight, FileText, Upload } from 'lucide-react';
import { STAGES_WITH_FULL_DETAILS, CONTACT_ROLES, STIP_TEMPLATES, EMPLOYMENT_TYPES, INCOME_TYPES } from '../lib/constants';
import { formatDate, formatCurrency, formatRate, calcPI, calcLTV, taskUrgency, urgencyColor } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { claudeService } from '../lib/claude';
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

  const handleSaveClose = async () => {
    if (newNote.trim()) {
      await ops.addNote(borrower.id, newNote.trim());
    }
    onClose?.();
  };

  return (
    <div>
      <div className="section-heading">NOTES</div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input
          type="text"
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="Add a note..."
          style={{ flex: 1, padding: '8px 12px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }}
        />
        <button
          type="button"
          onClick={handleAdd}
          style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '5px', fontWeight: '600', cursor: 'pointer' }}
        >Add</button>
        <button
          type="button"
          onClick={handleSaveClose}
          style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '5px', fontWeight: '600', cursor: 'pointer', fontSize: '11px' }}
        >Save/Close</button>
      </div>
      {noteLines.length > 0 && (
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {noteLines.map((line, i) => {
            // Parse [M/D/YY] prefix
            const match = line.match(/^\[(\d{1,2}\/\d{1,2}\/\d{2})\]\s*(.*)$/);
            const dateStr = match ? match[1] : '';
            const noteText = match ? match[2] : line;
            return (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '8px', marginBottom: '4px', background: '#1e293b', borderRadius: '5px' }}>
                {dateStr && (
                  <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '600', flexShrink: 0, minWidth: '50px' }}>{dateStr}</span>
                )}
                <span style={{ fontSize: '12px', color: '#e2e8f0', flex: 1 }}>{noteText}</span>
              </div>
            );
          })}
        </div>
      )}
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
                width: '22px', height: '22px', borderRadius: '4px', flexShrink: 0,
                background: isCompleted ? '#22c55e' : '#fff',
                border: `2px solid ${isCompleted ? '#22c55e' : '#cbd5e1'}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '12px', fontWeight: '700',
              }}
            >
              {isCompleted ? '✓' : ''}
            </button>
            <span style={{ flex: 1, fontSize: '12px', color: isCompleted ? '#94a3b8' : '#1e293b', textDecoration: isCompleted ? 'line-through' : 'none' }}>
              {isAppt ? '📅 ' : ''}{task.title}
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

// ---- Document Drop Zone ----
const DocDropZone = ({ borrower, onDocAdded, ops }) => {
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState([]); // pending files not yet processed
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState([]); // per-file status
  const [docs, setDocs] = useState([]);
  const [showDocs, setShowDocs] = useState(false);
  const inputRef = useRef();

  const loadDocs = useCallback(async () => {
    const { data } = await supabase.from('Documents').select('*').eq('borrower_id', borrower.id).order('created_at', { ascending: false });
    setDocs(data || []);
  }, [borrower.id]);

  React.useEffect(() => { loadDocs(); }, [loadDocs]);

  const addFilesToQueue = (files) => {
    const newFiles = Array.from(files).filter(f =>
      f.type === 'application/pdf' || f.type.startsWith('image/')
    );
    setQueue(q => [...q, ...newFiles]);
  };

  const removeFromQueue = (idx) => setQueue(q => q.filter((_, i) => i !== idx));

  const processQueue = async () => {
    if (queue.length === 0) return;
    setProcessing(true);
    setProgress(queue.map(f => ({ name: f.name, status: 'pending' })));

    for (let i = 0; i < queue.length; i++) {
      const file = queue[i];
      setProgress(p => p.map((x, j) => j === i ? { ...x, status: 'uploading' } : x));

      try {
          const base64 = await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = ev => res(ev.target.result.split(',')[1]);
            reader.onerror = rej;
            reader.readAsDataURL(file);
          });

          const mimeType = file.type || 'application/pdf';

          setProgress(p => p.map((x, j) => j === i ? { ...x, status: 'analyzing' } : x));
          let aiSummary = '';
          let extracted = {};
          try {
            const result = await claudeService.analyzeDocument(base64, mimeType, file.name);
            aiSummary = result.summary;
            extracted = result.extracted;
          } catch (e) {
            aiSummary = 'AI analysis unavailable';
          }

          let filePath = '';
          try {
            const path = `${borrower.id}/${Date.now()}_${file.name}`;
            const { error: upErr } = await supabase.storage.from('Documents').upload(path, file);
            if (!upErr) {
              const { data: urlData } = supabase.storage.from('Documents').getPublicUrl(path);
              filePath = urlData.publicUrl;
            }
          } catch (e) { /* storage not configured */ }

          await supabase.from('Documents').insert([{
            borrower_id: borrower.id, name: file.name,
            file_path: filePath || file.name, file_type: file.type,
            file_size: file.size, ai_summary: aiSummary,
          }]);

          if (aiSummary && aiSummary !== 'AI analysis unavailable') {
            const currentNotes = borrower.notes || '';
            const newNote = `\n\n📄 ${file.name} (${new Date().toLocaleDateString()}):\n${aiSummary}`;
            await supabase.from('borrowers').update({ notes: currentNotes + newNote }).eq('id', borrower.id);
          }

          console.log('=== AI EXTRACTED DATA ===');
          console.log(JSON.stringify(extracted, null, 2));
          console.log('buyer_agent_name:', extracted.buyer_agent_name);
          console.log('contingencies:', extracted.contingencies);
          const updates = {};
          if (extracted.purchase_price) updates.purchase_price = extracted.purchase_price;
          if (extracted.coe_date) updates.coe_date = extracted.coe_date;
          if (extracted.dti) updates.dti = extracted.dti;
          if (extracted.ltv) updates.ltv = extracted.ltv;
          if (extracted.earnest_money) updates.earnest_money = extracted.earnest_money;
          if (extracted.seller_cc) updates.seller_cc = extracted.seller_cc;
          if (extracted.appraisal_value) updates.appraisal_value = extracted.appraisal_value;
          if (extracted.appraisal_type) updates.appraisal_type = extracted.appraisal_type;
          if (extracted.appraisal_subject_to) updates.appraisal_subject_to = extracted.appraisal_subject_to;
          if (extracted.appraisal_reinspection !== undefined) updates.appraisal_reinspection = extracted.appraisal_reinspection;
          if (extracted.property_type) updates.property_type = extracted.property_type;
          if (extracted.occupancy) updates.occupancy = extracted.occupancy;
          if (Object.keys(updates).length > 0) {
            await supabase.from('borrowers').update(updates).eq('id', borrower.id);
          }

          // Auto-add contacts from PA
          if (extracted.buyer_agent_name) {
            await ops.upsertContact(borrower.id, 'buyers_agent', {
              name: extracted.buyer_agent_name,
              phone: extracted.buyer_agent_phone || '',
              email: extracted.buyer_agent_email || '',
              company: extracted.buyer_agent_company || ''
            });
          }
          if (extracted.listing_agent_name) {
            await ops.upsertContact(borrower.id, 'listing_agent', {
              name: extracted.listing_agent_name,
              phone: extracted.listing_agent_phone || '',
              email: extracted.listing_agent_email || '',
              company: extracted.listing_agent_company || ''
            });
          }
          if (extracted.title_company) {
            await ops.upsertContact(borrower.id, 'title_escrow', {
              company: extracted.title_company,
              phone: extracted.title_company_phone || '',
              email: extracted.title_company_email || ''
            });
          }

          // Auto-add contingencies from PA
          if (extracted.contingencies && Array.isArray(extracted.contingencies)) {
            for (const c of extracted.contingencies) {
              const flagPrefix = c.fully_executed === false ? '🚩 ' : '';
              await ops.addContingency(borrower.id, flagPrefix + c.name, c.due_date || null);
            }
          }

          // Auto-add incomes from VOE/paystub/tax returns
          if (extracted.incomes && Array.isArray(extracted.incomes)) {
            const existingIncomes = borrower.incomes || [];
            const newIncomes = extracted.incomes.map(inc => ({ ...inc, id: Date.now() + Math.random() }));
            await supabase.from('borrowers').update({ incomes: [...existingIncomes, ...newIncomes] }).eq('id', borrower.id);
          }

          setProgress(p => p.map((x, j) => j === i ? { ...x, status: 'done', summary: aiSummary } : x));
        } catch (e) {
          setProgress(p => p.map((x, j) => j === i ? { ...x, status: 'error', error: e.message } : x));
        }
    }

    setProcessing(false);
    setQueue([]);
    loadDocs();
    if (onDocAdded) onDocAdded();
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFilesToQueue(e.dataTransfer.files);
  };

  const statusColor = (s) => s === 'done' ? '#22c55e' : s === 'error' ? '#f87171' : s === 'analyzing' ? '#b07eff' : '#fbbf24';
  const statusLabel = (s) => s === 'done' ? '✅ Done' : s === 'error' ? '❌ Error' : s === 'analyzing' ? '🤖 Analyzing…' : s === 'uploading' ? '⬆️ Uploading…' : '⏳ Pending';

  return (
    <div>
      <div className="section-heading">
        📎 Documents
        <button type="button" className="btn-xs btn-ghost" onClick={() => setShowDocs(s => !s)} style={{ marginLeft: 'auto' }}>
          {showDocs ? 'Hide' : `Show saved (${docs.length})`}
        </button>
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

      {/* Pending queue */}
      {queue.length > 0 && !processing && (
        <div style={{ background: '#1e1e2a', border: '1px solid #3a3a55', borderRadius: '8px', padding: '12px', marginTop: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#f0f0ff', marginBottom: '8px' }}>
            📋 Ready to process ({queue.length} file{queue.length > 1 ? 's' : ''})
          </div>
          {queue.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #3a3a55', fontSize: '12px' }}>
              <FileText size={13} style={{ color: '#93c5fd', flexShrink: 0 }} />
              <span style={{ flex: 1, color: '#b8b8d8' }}>{f.name}</span>
              <span style={{ color: '#8080a8', fontSize: '11px' }}>{(f.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => removeFromQueue(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '16px', lineHeight: 1 }}>×</button>
            </div>
          ))}
          <button
            type="button"
            onClick={processQueue}
            style={{
              marginTop: '10px', width: '100%', padding: '9px', borderRadius: '6px',
              background: '#8b4cf7', color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: '700', letterSpacing: '0.02em',
            }}
          >
            🤖 Process {queue.length} Document{queue.length > 1 ? 's' : ''} with AI
          </button>
        </div>
      )}

      {/* Processing progress */}
      {processing && progress.length > 0 && (
        <div style={{ background: '#1e1e2a', border: '1px solid #3a3a55', borderRadius: '8px', padding: '12px', marginTop: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#f0f0ff', marginBottom: '8px' }}>🤖 Processing documents…</div>
          {progress.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 0', borderBottom: '1px solid #3a3a55', fontSize: '12px' }}>
              <FileText size={13} style={{ color: '#93c5fd', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: '#f0f0ff', fontWeight: '600' }}>{p.name}</div>
                {p.summary && <div style={{ color: '#b8b8d8', fontSize: '11px', marginTop: '2px', lineHeight: 1.4 }}>{p.summary}</div>}
              </div>
              <span style={{ color: statusColor(p.status), fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>{statusLabel(p.status)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Completed results — compact inline */}
      {!processing && progress.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '8px', padding: '8px 12px', background: '#0d2010', border: '1px solid #22c55e', borderRadius: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#22c55e', whiteSpace: 'nowrap' }}>✅ Done:</span>
          <div style={{ flex: 1, fontSize: '11px', color: '#b8b8d8', lineHeight: 1.5 }}>
            {progress.map((p, i) => (
              <span key={i}>{p.name.length > 30 ? p.name.slice(0, 30) + '…' : p.name}{i < progress.length - 1 ? ' · ' : ''}</span>
            ))}
          </div>
          <button type="button" onClick={() => setProgress([])}
            style={{ padding: '2px 8px', background: 'transparent', border: '1px solid #22c55e', color: '#22c55e', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>
            ✕
          </button>
        </div>
      )}

      {/* Saved docs list with delete */}
      {showDocs && (
        <div style={{ background: '#1e1e2a', border: '1px solid #3a3a55', borderRadius: '8px', padding: '10px', marginTop: '10px' }}>
          {docs.length === 0 && <div style={{ color: '#8080a8', fontSize: '12px' }}>No documents saved yet.</div>}
          {docs.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '7px 0', borderBottom: '1px solid #3a3a55', fontSize: '12px' }}>
              <FileText size={13} style={{ color: '#93c5fd', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <a href={doc.file_path} target="_blank" rel="noopener noreferrer"
                  style={{ color: '#b07eff', textDecoration: 'none', fontWeight: '600', fontSize: '12px' }}>
                  {doc.name}
                </a>
                {doc.ai_summary && (
                  <div style={{ color: '#b8b8d8', marginTop: '3px', lineHeight: 1.5, fontSize: '11px' }}>{doc.ai_summary}</div>
                )}
              </div>
              <span style={{ color: '#8080a8', flexShrink: 0, fontSize: '11px', fontFamily: 'monospace' }}>{formatDate(doc.created_at)}</span>
              <button type="button" onClick={async () => {
                if (!window.confirm(`Delete "${doc.name}"?`)) return;
                await supabase.from('Documents').delete().eq('id', doc.id);
                loadDocs();
              }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }} title="Delete">
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
    const { data } = await supabase.from('Documents').select('*').eq('borrower_id', borrower.id).order('created_at', { ascending: false });
    setDocs(data || []);
  }, [borrower.id]);

  React.useEffect(() => { loadDocs(); }, [loadDocs]);

  const deleteDoc = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}"?`)) return;
    await supabase.from('Documents').delete().eq('id', doc.id);
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

// ---- Needs List ----
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
        <Field label="Property Type" value={borrower.property_type} dbKey="property_type" />
        <Field label="Occupancy" value={borrower.occupancy} dbKey="occupancy" />
        <Field label="Earnest Money" value={borrower.earnest_money} dbKey="earnest_money" type="number" />
      </div>
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
const CreditReportSection = ({ borrower, onUpdate }) => {
  const [uploading, setUploading] = useState(false);
  const [viewingReport, setViewingReport] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const creditData = borrower.credit_report || {};
  const hasReport = creditData.file_path || creditData.file_url || creditData.uploaded_at;
  const [signedUrl, setSignedUrl] = useState(null);

  // Get signed URL when viewing
  const openReport = async () => {
    if (creditData.file_path) {
      const { data } = await supabase.storage.from('Documents').createSignedUrl(creditData.file_path, 3600); // 1 hour
      if (data?.signedUrl) {
        setSignedUrl(data.signedUrl);
        setViewingReport(true);
      }
    } else if (creditData.file_url) {
      setSignedUrl(creditData.file_url);
      setViewingReport(true);
    }
  };

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      // Upload to Supabase storage (public Documents bucket)
      const fileName = `credit_${borrower.id}_${Date.now()}.pdf`;
      const { data, error } = await supabase.storage.from('Documents').upload(fileName, file);
      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage.from('Documents').getPublicUrl(fileName);

      // Save credit report info
      await onUpdate(borrower.id, {
        credit_report: {
          file_path: fileName,
          file_url: urlData.publicUrl,
          file_name: file.name,
          uploaded_at: new Date().toISOString(),
          scores: creditData.scores || {},
          total_liabilities: creditData.total_liabilities || null,
          negative_marks: creditData.negative_marks || 0,
          public_records: creditData.public_records || 0,
          discrepancies: creditData.discrepancies || [],
        }
      });
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload: ' + err.message);
    }
    setUploading(false);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    await uploadFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type === 'application/pdf') {
      await uploadFile(file);
    } else {
      alert('Please drop a PDF file');
    }
  };

  return (
    <div>
      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          padding: '20px', borderRadius: '8px', marginBottom: '16px',
          background: dragging ? '#fef08a' : '#fef3c7',
          border: `2px dashed ${dragging ? '#eab308' : '#f59e0b'}`,
          textAlign: 'center', cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <FileText size={24} style={{ color: '#f59e0b', marginBottom: '6px' }} />
        <div style={{ fontSize: '12px', color: '#92400e', fontWeight: '600' }}>
          {uploading ? 'Uploading...' : dragging ? 'Drop it!' : 'Drop Credit Report PDF or Click to Browse'}
        </div>
        <input ref={inputRef} type="file" accept=".pdf" onChange={handleFileSelect} style={{ display: 'none' }} />
      </div>

      {/* Credit Report Summary */}
      {hasReport && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>
              📄 {creditData.file_name || 'Credit Report'}
            </div>
            <button
              onClick={openReport}
              style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
            >
              View Report
            </button>
          </div>

          {/* Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: '#f1f5f9', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Scores</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                {creditData.scores?.equifax || '—'} / {creditData.scores?.experian || '—'} / {creditData.scores?.transunion || '—'}
              </div>
            </div>
            <div style={{ background: creditData.negative_marks > 0 ? '#fee2e2' : '#f1f5f9', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Negative Marks</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: creditData.negative_marks > 0 ? '#dc2626' : '#1e293b' }}>
                {creditData.negative_marks || 0}
              </div>
            </div>
            <div style={{ background: creditData.public_records > 0 ? '#fee2e2' : '#f1f5f9', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Public Records</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: creditData.public_records > 0 ? '#dc2626' : '#1e293b' }}>
                {creditData.public_records || 0}
              </div>
            </div>
          </div>

          {/* Discrepancies */}
          {creditData.discrepancies?.length > 0 && (
            <div style={{ background: '#fef3c7', padding: '8px', borderRadius: '6px', marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>⚠️ Discrepancies</div>
              {creditData.discrepancies.map((d, i) => (
                <div key={i} style={{ fontSize: '11px', color: '#78350f' }}>• {d}</div>
              ))}
            </div>
          )}

          <div style={{ fontSize: '10px', color: '#64748b' }}>
            Uploaded: {creditData.uploaded_at ? format(parseISO(creditData.uploaded_at), 'M/d/yy h:mma') : '—'}
          </div>
        </div>
      )}

      {/* Report Viewer Modal */}
      {viewingReport && signedUrl && (
        <>
          <div onClick={() => setViewingReport(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000 }} />
          <div style={{
            position: 'fixed', top: '5%', left: '5%', right: '5%', bottom: '5%',
            background: '#fff', borderRadius: '12px', zIndex: 1001,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '600', color: '#1e293b' }}>Credit Report - {borrower.name}</span>
              <button onClick={() => setViewingReport(false)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                Close
              </button>
            </div>
            <iframe src={signedUrl} style={{ flex: 1, border: 'none' }} title="Credit Report" />
          </div>
        </>
      )}
    </div>
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

  return (
    <div>
      {/* Drop Zone for Income Docs */}
      <div
        style={{
          padding: '16px', borderRadius: '8px', marginBottom: '12px',
          background: '#f0fdf4', border: '2px dashed #22c55e', textAlign: 'center',
        }}
      >
        <Upload size={20} style={{ color: '#22c55e', marginBottom: '6px' }} />
        <div style={{ fontSize: '11px', color: '#166534', fontWeight: '600' }}>Drop VOE, Paystub, or Tax Return here</div>
        <div style={{ fontSize: '10px', color: '#64748b' }}>to auto-populate income fields</div>
      </div>

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
    { id: 'notes',    label: 'Notes & Tasks' },
    { id: 'docs',     label: 'Documents' },
    { id: 'borrowers', label: 'Borrowers' },
    { id: 'terms',    label: 'Loan Terms' },
    { id: 'income',   label: 'Income' },
    { id: 'contacts', label: 'Contacts' },
    { id: 'stips',    label: 'Needs List' },
    { id: 'contingencies', label: 'Contingencies' },
    { id: 'credit',   label: 'Credit Report' },
    { id: 'appraisal', label: 'Appraisal' },
    { id: 'preapproval', label: 'Preapproval' },
    { id: 'history',  label: 'History' },
  ];

  const boxStyle = { background: '#f1f5f9', borderRadius: '8px', padding: '16px', border: '2px solid #0d9488', width: '400px', flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: '200px' };
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
      {/* Contact Links Row - contact on left, lender on right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', marginBottom: '8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          {borrower.phone && (
            <a href={`tel:${borrower.phone}`} style={{ color: '#3b82f6', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>CALL</a>
          )}
          {borrower.phone && (
            <a href={`sms:${borrower.phone}`} style={{ color: '#3b82f6', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>TEXT</a>
          )}
          {borrower.email && (
            <a href={`mailto:${borrower.email}`} style={{ color: '#3b82f6', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>EMAIL</a>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {borrower.lender && <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: '600' }}>{borrower.lender}</span>}
        </div>
      </div>

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
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>📝 Notes & Tasks</div>
            <NotesSection borrower={borrower} ops={ops} onClose={onClose} />
            <TasksSection borrower={borrower} ops={ops} />
            {closeBtn('notes')}
          </div>
        )}

        {openTabs.has('docs') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>📄 Upload Documents</div>
            <DocDropZone borrower={borrower} onDocAdded={() => ops.refetch()} ops={ops} />
            {closeBtn('docs')}
          </div>
        )}

        {openTabs.has('borrowers') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>👤 Borrowers</div>
            <BorrowersSection borrower={borrower} onUpdate={ops.updateBorrower} />
            {closeBtn('borrowers')}
          </div>
        )}

        {openTabs.has('terms') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>💰 Loan Terms</div>
            <LoanTermsGrid borrower={borrower} onUpdate={ops.updateBorrower} />
            {closeBtn('terms')}
          </div>
        )}

        {openTabs.has('income') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>💵 Income / Employment</div>
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

        {openTabs.has('stips') && (
          <div style={boxStyle}>
            <StipulationsSection borrower={borrower} ops={ops} />
            {closeBtn('stips')}
          </div>
        )}

        {openTabs.has('contingencies') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>⚠️ Contingencies</div>
            <ContingenciesSection borrower={borrower} ops={ops} />
            {closeBtn('contingencies')}
          </div>
        )}

        {openTabs.has('credit') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>📊 Credit Report</div>
            <CreditReportSection borrower={borrower} onUpdate={ops.updateBorrower} />
            {closeBtn('credit')}
          </div>
        )}

        {openTabs.has('appraisal') && (
          <div style={boxStyle}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>
              🏠 Appraisal {borrower.appraisal_type && <span style={{ fontWeight: '400', color: '#1e293b' }}>— {borrower.appraisal_type}</span>}
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
