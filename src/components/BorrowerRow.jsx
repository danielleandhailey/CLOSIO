import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Trash2, Clock, Upload, Calendar, ArrowRight, Edit3 } from 'lucide-react';
import { STAGE_COLORS, STAGES, PRESET_TAGS, LENDER_OPTIONS, SECONDARY_LENDER, LOAN_TYPE_OPTIONS, STAGES_WITH_AUTO_TAGS } from '../lib/constants';
import { formatCurrency, calcPI, calcLTV, getTagStyle, touchedRecently, formatBorrowerName } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';

// Parse quick log entries from notes field
const parseLog = (notes) => {
  if (!notes) return [];
  const lines = notes.split('\n');
  const entries = [];
  lines.forEach(line => {
    const match = line.match(/^\[(\d{2}\/\d{2} \d{1,2}:\d{2}[ap]m)\] (.+)$/);
    if (match) entries.push({ timestamp: match[1], text: match[2] });
  });
  return entries.reverse(); // newest first
};

const appendLog = (existing, text) => {
  const stamp = format(new Date(), 'MM/dd h:mma');
  const entry = `[${stamp}] ${text}`;
  return existing ? `${existing}\n${entry}` : entry;
};

// Quick Note Input - inline on row
const QuickNoteInput = ({ borrower, onAddNote }) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const inputRef = useRef();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const save = async () => {
    if (!note.trim()) return;
    const dateStamp = format(new Date(), 'M/d/yy');
    const newNote = `[${dateStamp}] ${note.trim()}`;
    const existing = borrower.notes || '';
    await onAddNote(borrower.id, existing ? `${newNote}\n${existing}` : newNote);
    setNote('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        style={{
          background: 'none', border: '1px dashed #64748b', borderRadius: '4px',
          padding: '3px 8px', fontSize: '10px', color: '#94a3b8', cursor: 'pointer', marginRight: '12px',
        }}
      >+ Note</button>
    );
  }

  return (
    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px', marginRight: '12px' }}>
      <input
        ref={inputRef}
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setOpen(false); }}
        placeholder="Quick note..."
        style={{ width: '180px', padding: '3px 6px', fontSize: '11px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)' }}
      />
      <button onClick={save} style={{ padding: '3px 8px', fontSize: '10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
      <button onClick={() => setOpen(false)} style={{ padding: '3px 6px', fontSize: '10px', background: 'none', color: '#94a3b8', border: 'none', cursor: 'pointer' }}>×</button>
    </div>
  );
};

// Quick Log + Summary Panel
const QuickSummaryPanel = ({ borrower, onMoveStage, onClose }) => {
  const [showStageSelect, setShowStageSelect] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef();
  const inputRef = useRef();
  const sc = STAGE_COLORS[borrower.stage] || STAGE_COLORS['Working'];
  const pi = calcPI(borrower.loan_amount, borrower.rate);
  const ltv = calcLTV(borrower.loan_amount, borrower.purchase_price);
  const logEntries = parseLog(borrower.notes);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const saveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    const updated = appendLog(borrower.notes, note.trim());
    const { error } = await supabase.from('borrowers')
      .update({ notes: updated, last_touched: new Date().toISOString() })
      .eq('id', borrower.id);
    if (error) console.error('Note save error:', error);
    // Optimistically update the local display
    borrower.notes = updated;
    setNote('');
    setSaving(false);
  };

  return (
    <div ref={panelRef} className="quick-summary-panel" style={{ width: '340px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: '800', color: '#f0f0ff' }}>{formatBorrowerName(borrower.name, borrower.co_borrower, borrower.co_borrowers)}</span>
        <button
          type="button"
          onClick={() => setShowStageSelect(s => !s)}
          title="Click to move stage"
          style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '800', background: sc.bg, color: sc.text, textTransform: 'uppercase', border: 'none', cursor: 'pointer', letterSpacing: '0.04em' }}
        >
          {borrower.stage} ▾
        </button>
      </div>

      {/* Key stats — compact 3-col */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '12px', padding: '8px', background: '#13131a', borderRadius: '6px' }}>
        {[
          ['Price', formatCurrency(borrower.purchase_price)],
          ['Loan', formatCurrency(borrower.loan_amount)],
          ['Rate', borrower.rate ? `${borrower.rate}%` : '—'],
          ['P&I', pi ? `$${Math.round(pi).toLocaleString()}` : '—'],
          ['LTV', ltv ? `${ltv}%` : '—'],
          ['COE', borrower.coe_date ? format(parseISO(borrower.coe_date), 'M/d') : '—'],
        ].map(([label, val]) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#8080a8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontSize: '12px', color: '#f0f0ff', fontWeight: '700', marginTop: '1px' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Quick note input */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: '#8080a8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>
          📝 Quick Log
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            ref={inputRef}
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveNote()}
            placeholder="Type a note, press Enter…"
            style={{
              flex: 1, background: '#13131a', border: '1px solid #3a3a55',
              color: '#f0f0ff', padding: '6px 10px', borderRadius: '5px',
              fontSize: '12px', outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={saveNote}
            disabled={saving || !note.trim()}
            style={{
              padding: '6px 12px', background: '#8b4cf7', color: '#fff',
              border: 'none', borderRadius: '5px', fontSize: '12px',
              fontWeight: '700', cursor: 'pointer', opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? '…' : '+ Log'}
          </button>
        </div>
      </div>

      {/* Log history */}
      {logEntries.length > 0 && (
        <div style={{ maxHeight: '160px', overflowY: 'auto', marginBottom: '10px', borderRadius: '5px', border: '1px solid #3a3a55' }}>
          {logEntries.map((entry, i) => (
            <div key={i} style={{
              padding: '6px 10px', borderBottom: i < logEntries.length - 1 ? '1px solid #28283a' : 'none',
              display: 'flex', gap: '8px', alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: '10px', color: '#8b4cf7', fontFamily: 'monospace', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>
                {entry.timestamp}
              </span>
              <span style={{ fontSize: '12px', color: '#b8b8d8', lineHeight: 1.4 }}>{entry.text}</span>
            </div>
          ))}
        </div>
      )}
      {logEntries.length === 0 && (
        <div style={{ fontSize: '11px', color: '#50507a', textAlign: 'center', padding: '8px 0', marginBottom: '10px' }}>
          No log entries yet — type above to start
        </div>
      )}

      {/* Divider */}
      <div style={{ height: '1px', background: '#3a3a55', marginBottom: '10px' }} />

      {/* Move Stage */}
      {showStageSelect ? (
        <div>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#8080a8', textTransform: 'uppercase', marginBottom: '6px' }}>Move to Stage</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {STAGES.filter(s => s !== borrower.stage).map(s => {
              const c = STAGE_COLORS[s];
              return (
                <button key={s} type="button"
                  onClick={() => { onMoveStage(s); onClose(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 10px', borderRadius: '5px', border: 'none',
                    background: c.bg, color: '#fff', cursor: 'pointer',
                    fontSize: '11px', fontWeight: '700', textAlign: 'left', textTransform: 'uppercase',
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setShowStageSelect(false)}
            style={{ marginTop: '6px', width: '100%', padding: '5px', background: 'transparent', border: '1px solid #3a3a55', color: '#8080a8', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowStageSelect(true)}
          style={{ width: '100%', padding: '7px', background: '#28283a', border: '1px solid #50507a', color: '#b8b8d8', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
          Move Stage →
        </button>
      )}
    </div>
  );
};

// Tag pill with remove
const TagPill = ({ tag, tagId, onRemove }) => {
  const style = getTagStyle(tag);
  return (
    <span className="tag-pill" style={style}>
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove(tagId); }}
          style={{ marginLeft: '3px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '10px', lineHeight: 1 }}
        >×</button>
      )}
    </span>
  );
};

// Generic dropdown hook
const useDropdown = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return [open, setOpen, ref];
};

// Dropdown panel style
const dropStyle = {
  position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999,
  background: '#fff', border: '1px solid #ddd', borderRadius: '8px',
  padding: '8px', minWidth: '180px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
};

// Inline add tag
const AddTagInline = ({ borrower, onAdd, sc }) => {
  const [open, setOpen, ref] = useDropdown();
  const [custom, setCustom] = useState('');
  const existingTags = (borrower.borrower_tags || []).map(t => t.tag);

  const handleAdd = (tag) => {
    onAdd(tag);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button"
        onClick={e => { e.stopPropagation(); e.preventDefault(); setOpen(o => !o); }}
        style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
          border: '1px dashed #50507a', background: 'transparent', color: '#8080a8', cursor: 'pointer' }}>
        + Tag
      </button>
      {open && (
        <div style={{ ...dropStyle, minWidth: '220px' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
            {PRESET_TAGS.filter(t => !existingTags.includes(t.label)).map(t => (
              <button key={t.label} type="button"
                style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer', background: t.bg, color: t.color }}
                onClick={e => { e.stopPropagation(); handleAdd(t.label); }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #eee', paddingTop: '8px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input value={custom} onChange={e => setCustom(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) { handleAdd(custom.trim()); setCustom(''); } }}
                placeholder="Custom tag…"
                style={{ flex: 1, background: '#f5f5f5', border: '1px solid #ddd', color: '#333', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', outline: 'none' }} />
              <button type="button" onClick={e => { e.stopPropagation(); if (custom.trim()) { handleAdd(custom.trim()); setCustom(''); } }}
                style={{ padding: '4px 10px', background: '#8b4cf7', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Lender badge with dropdown + Flyhomes secondary
const LenderBadge = ({ borrower, onUpdate }) => {
  const [open, setOpen, ref] = useDropdown();
  const [custom, setCustom] = useState('');
  const lender = borrower.lender;
  const lender2 = borrower.lender_2;

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
        <button type="button"
          onClick={e => { e.stopPropagation(); e.preventDefault(); setOpen(o => !o); }}
          style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
            border: '1px dashed #50507a', background: 'transparent',
            color: '#8080a8', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + Lender
        </button>
        {open && (
          <div style={dropStyle}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>Lender</div>
            {[...LENDER_OPTIONS, SECONDARY_LENDER].map(l => (
              <button key={l} type="button"
                onClick={e => { e.stopPropagation();
                  if (l === SECONDARY_LENDER) {
                    onUpdate(borrower.id, { lender_2: l });
                  } else {
                    onUpdate(borrower.id, { lender: l });
                  }
                  setOpen(false); }}
                style={{ display: 'block', width: '100%', padding: '6px 10px', border: 'none',
                  background: (lender === l || lender2 === l) ? '#ede9fe' : 'transparent',
                  color: l === SECONDARY_LENDER ? '#d97706' : ((lender === l || lender2 === l) ? '#6d28d9' : '#333'),
                  cursor: 'pointer', borderRadius: '4px', fontSize: '12px',
                  fontWeight: (lender === l || lender2 === l) ? '700' : '500', textAlign: 'left',
                  borderTop: l === SECONDARY_LENDER ? '1px solid #eee' : 'none', marginTop: l === SECONDARY_LENDER ? '4px' : '0' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={e => e.currentTarget.style.background = (lender === l || lender2 === l) ? '#ede9fe' : 'transparent'}
              >
                {l === SECONDARY_LENDER ? `+ ${l} (2nd)` : l}
              </button>
            ))}
            <div style={{ borderTop: '1px solid #eee', marginTop: '6px', paddingTop: '6px' }}>
              <input value={custom} onChange={e => setCustom(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) { onUpdate(borrower.id, { lender: custom.trim() }); setCustom(''); setOpen(false); } }}
                placeholder="Other lender…"
                style={{ width: '100%', background: '#f5f5f5', border: '1px solid #ddd', color: '#333', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', outline: 'none' }} />
            </div>
          </div>
        )}
      </div>
      {lender && (
        <span style={{ padding: '3px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
          background: '#14532d', color: '#86efac', border: '1px solid #22c55e', cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); if (window.confirm(`Remove ${lender}?`)) onUpdate(borrower.id, { lender: null }); }}>
          {lender} ×
        </span>
      )}
      {lender2 && (
        <span style={{ padding: '3px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
          background: '#78350f', color: '#fcd34d', border: '1px solid #d97706', cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); if (window.confirm('Remove Flyhomes?')) onUpdate(borrower.id, { lender_2: null }); }}>
          {lender2} ×
        </span>
      )}
    </div>
  );
};

// Auto-tags for Processing+ stages
const AutoTagPills = ({ borrower }) => {
  const pills = [];
  const add = (label, bg, color) => pills.push({ label, bg, color });

  if (borrower.coe_date) add(`COE ${format(parseISO(borrower.coe_date), 'M/d')}`, '#fee2e2', '#991b1b');
  if (borrower.loan_type) add(borrower.loan_type, '#ede9fe', '#6d28d9');
  if (borrower.rate_status === 'Locked') add('LOCKED', '#dcfce7', '#14532d');
  if (borrower.rate_status === 'Floating') add('FLOATING', '#ffedd5', '#9a3412');
  if (borrower.ltv || (borrower.loan_amount && borrower.purchase_price)) {
    const ltv = calcLTV(borrower.loan_amount, borrower.purchase_price) || borrower.ltv;
    if (ltv) add(`LTV ${ltv}%`, '#dbeafe', '#1e40af');
  }
  if (borrower.seller_cc) add(`SC $${Math.round(borrower.seller_cc / 1000)}k`, '#f1f5f9', '#475569');
  if (borrower.appraisal_value) add('Appraisal ✓', '#dcfce7', '#14532d');
  if (borrower.appraisal_waiver) add('PIW', '#dbeafe', '#1e40af');

  return (
    <>
      {pills.map((p, i) => (
        <span key={i} style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: '700',
          background: p.bg, color: p.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {p.label}
        </span>
      ))}
    </>
  );
};

// Stage dropdown on each row
const StageDropdown = ({ borrower, onMoveStage }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const sc = STAGE_COLORS[borrower.stage] || STAGE_COLORS['Working'];

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '3px',
          padding: '3px 9px', borderRadius: '5px', border: 'none',
          background: sc.bg, color: sc.text,
          fontSize: '11px', fontWeight: '800', cursor: 'pointer',
          whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      >
        {borrower.stage} ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 400,
          background: '#fff', border: '1px solid #ddd', borderRadius: '6px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', minWidth: '150px', padding: '4px',
        }}>
          {STAGES.filter(s => s !== borrower.stage).map(s => {
            const c = STAGE_COLORS[s];
            return (
              <button
                key={s}
                type="button"
                onClick={e => { e.stopPropagation(); onMoveStage(borrower.id, s, borrower.stage); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%', padding: '6px 10px', border: 'none',
                  background: 'transparent', cursor: 'pointer', borderRadius: '4px',
                  fontSize: '12px', fontWeight: '600', color: '#333',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: c.bg, flexShrink: 0, border: '1px solid rgba(0,0,0,0.1)' }} />
                {s}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Quick Note Input
const QuickNoteInput = ({ borrowerId, onAddNote }) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const inputRef = useRef();

  const handleAdd = async () => {
    if (!note.trim() || !onAddNote) return;
    await onAddNote(borrowerId, note.trim());
    setNote('');
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setNote('');
    }
  };

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            background: 'none', border: '1px dashed #64748b', borderRadius: '4px',
            padding: '4px 8px', fontSize: '10px', color: '#94a3b8', cursor: 'pointer',
          }}
          title="Add quick note"
        >+ Note</button>
      ) : (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Quick note..."
            style={{
              width: '150px', padding: '4px 8px', fontSize: '11px', border: '1px solid #3b82f6',
              borderRadius: '4px', background: '#1e293b', color: '#e2e8f0',
            }}
          />
          <button
            type="button"
            onClick={handleAdd}
            style={{ background: '#0d9488', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '10px', color: '#fff', cursor: 'pointer' }}
          >Add</button>
          <button
            type="button"
            onClick={() => { setOpen(false); setNote(''); }}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px' }}
          >x</button>
        </div>
      )}
    </div>
  );
};

// Inline Doc Drop Zone
const InlineDocDrop = ({ borrower, onDocDrop, onHighlight }) => {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showDropModal, setShowDropModal] = useState(false);
  const inputRef = useRef();

  const docs = borrower.documents || [];

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    onHighlight?.(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length && onDocDrop) {
      setUploading(true);
      await onDocDrop(borrower.id, files);
      setUploading(false);
      setShowDropModal(false);
    }
  }, [borrower.id, onDocDrop, onHighlight]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    onHighlight?.(false);
    if (files.length && onDocDrop) {
      setUploading(true);
      await onDocDrop(borrower.id, files);
      setUploading(false);
      setShowDropModal(false);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClick = (e) => {
    e.stopPropagation();
    onHighlight?.(true);
    setShowDropModal(true);
  };

  const closeModal = () => {
    setShowDropModal(false);
    onHighlight?.(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      {/* Drop Button */}
      <div
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragging(true); onHighlight?.(true); }}
        onDragLeave={e => { e.preventDefault(); setDragging(false); onHighlight?.(false); }}
        onDrop={handleDrop}
        onClick={handleClick}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          padding: '6px 14px', borderRadius: '6px',
          background: dragging ? '#3b82f630' : 'transparent',
          border: `1px dashed ${dragging ? '#3b82f6' : 'var(--border)'}`,
          cursor: 'pointer', flexShrink: 0,
          transition: 'all 0.15s',
        }}
        title="Click to open drop zone"
      >
        <Upload size={12} style={{ color: dragging ? '#3b82f6' : 'var(--text3)' }} />
        {uploading ? (
          <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: '600' }}>...</span>
        ) : (
          <span style={{ fontSize: '10px', color: dragging ? '#3b82f6' : 'var(--text3)' }}>
            {dragging ? 'Drop!' : 'Drop'}
          </span>
        )}
        {docs.length > 0 && <span style={{ fontSize: '9px', color: 'var(--text3)' }}>({docs.length})</span>}
      </div>

      {/* Drop Modal */}
      {showDropModal && (
        <>
          <div onClick={closeModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
            padding: '24px', zIndex: 1000, minWidth: '320px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontWeight: '700', color: 'var(--text)', fontSize: '14px' }}>Upload Documents</span>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '18px', cursor: 'pointer' }}>×</button>
            </div>

            {/* Large Drop Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              style={{
                padding: '40px 20px', borderRadius: '8px', textAlign: 'center',
                background: dragging ? '#3b82f620' : 'var(--surface2)',
                border: `2px dashed ${dragging ? '#3b82f6' : 'var(--border)'}`,
                marginBottom: '16px', transition: 'all 0.2s',
              }}
            >
              <Upload size={32} style={{ color: dragging ? '#3b82f6' : 'var(--text3)', marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', color: dragging ? '#3b82f6' : 'var(--text)', fontWeight: '600' }}>
                {dragging ? 'Drop files here!' : 'Drag & drop files here'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>PDF, PNG, JPG</div>
            </div>

            {/* Or Attach Button */}
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text3)', marginRight: '8px' }}>or</span>
              <button
                onClick={() => inputRef.current?.click()}
                style={{
                  padding: '8px 20px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                  background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer',
                }}
              >
                Browse Files
              </button>
            </div>

            {uploading && (
              <div style={{ textAlign: 'center', marginTop: '12px', color: '#3b82f6', fontSize: '12px' }}>
                Uploading...
              </div>
            )}
          </div>
        </>
      )}

      <input ref={inputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileSelect} style={{ display: 'none' }} />
    </div>
  );
};

// Main condensed row
const BorrowerRow = ({
  borrower, isExpanded, isSelected,
  onSelect, onExpand, onEdit, onDelete,
  onTouch, onMoveStage, onAddTag, onRemoveTag,
  onOpenCalendar, onUpdate, onDocDrop, onAddNote,
}) => {
  const [showSummary, setShowSummary] = useState(false);
  const [dropHighlight, setDropHighlight] = useState(false);
  const tags = borrower.borrower_tags || [];
  const touched = touchedRecently(borrower.last_touched);

  const touchLabel = borrower.last_touched
    ? format(typeof borrower.last_touched === 'string' ? parseISO(borrower.last_touched) : borrower.last_touched, 'M/d')
    : '—';

  return (
    <div style={{ position: 'relative' }}>
      <div className={`borrower-row ${isExpanded ? 'expanded' : ''}`} style={dropHighlight ? { background: '#e0f2fe', boxShadow: '0 0 0 2px #7dd3fc' } : {}}>
        {/* Checkbox */}
        <input type="checkbox" className="borrower-checkbox" checked={isSelected} onChange={e => onSelect(borrower.id, e.target.checked)} />

        {/* Star/Favorite */}
        <span
          onClick={(e) => { e.stopPropagation(); onUpdate(borrower.id, { is_favorite: !borrower.is_favorite }); }}
          style={{
            cursor: 'pointer',
            fontSize: '16px',
            color: borrower.is_favorite ? '#fbbf24' : '#4a5568',
            marginRight: '4px',
          }}
          title={borrower.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {borrower.is_favorite ? '★' : '☆'}
        </span>

        {/* Need button - adds STIPS pill */}
        <span
          onClick={(e) => {
            e.stopPropagation();
            onUpdate(borrower.id, { substage: borrower.substage === 'Stips Needed' ? null : 'Stips Needed' });
          }}
          style={{
            cursor: 'pointer',
            fontSize: '9px',
            fontWeight: '600',
            color: borrower.substage === 'Stips Needed' ? '#fbbf24' : '#4a5568',
            marginRight: '6px',
            padding: '2px 4px',
            border: `1px dashed ${borrower.substage === 'Stips Needed' ? '#fbbf24' : '#4a5568'}`,
            borderRadius: '3px',
          }}
          title={borrower.substage === 'Stips Needed' ? 'Remove STIPS' : 'Add STIPS'}
        >
          Need
        </span>

        {/* Stage dropdown */}
        <StageDropdown borrower={borrower} onMoveStage={onMoveStage} />

        {/* Expand toggle — right after stage for easy access */}
        <button
          type="button"
          onClick={() => onExpand(borrower.id)}
          title="Expand / Collapse"
          style={{
            width: '26px', height: '26px', borderRadius: '5px', border: `1px solid ${STAGE_COLORS[borrower.stage]?.bg || '#50507a'}`,
            background: isExpanded ? STAGE_COLORS[borrower.stage]?.bg : 'var(--surface2)', color: 'var(--text)',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: '13px', fontWeight: '900', transition: 'all 0.15s',
          }}
        >
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {/* Name + NEW badge + Sync badge */}
        <span className="borrower-name">
          {formatBorrowerName(borrower.name, borrower.co_borrower, borrower.co_borrowers)}
          {borrower.is_new && (
            <span style={{
              marginLeft: '8px',
              padding: '1px 6px',
              background: '#ff1493',
              color: '#fff',
              fontSize: '9px',
              fontWeight: '700',
              borderRadius: '3px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              cursor: 'pointer',
            }}
            title="Click to dismiss"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate(borrower.id, { is_new: false });
            }}
            >NEW</span>
          )}
          {borrower.bonzo_last_sync && !borrower.is_new && (
            <span style={{
              marginLeft: '6px',
              color: '#00ff7f',
              fontSize: '10px',
              fontWeight: '600',
            }}
            title={`Synced from Bonzo: ${format(parseISO(borrower.bonzo_last_sync), 'M/d h:mma')}`}
            >{format(parseISO(borrower.bonzo_last_sync), 'M/d')}</span>
          )}
          {borrower.substage === 'Stips Needed' && (
            <span style={{
              marginLeft: '6px',
              padding: '1px 6px',
              background: '#fbbf24',
              color: '#000',
              fontSize: '9px',
              fontWeight: '700',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
            title="Click to clear"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate(borrower.id, { substage: null });
            }}
            >STIPS</span>
          )}
        </span>

        {/* Spacer to push notes to fixed position */}
        <div style={{ width: '20px', flexShrink: 0 }} />

        {/* Notes Display - notes only (no docs, no timestamps) */}
        {(() => {
          const rawNotes = borrower.notes || '';
          // Split on lines that start with [date] pattern to handle multi-line notes
          const noteParts = rawNotes.split(/(?=\[\d{1,2}\/\d{1,2}\/\d{2}\])/);
          // Also include non-dated notes as separate entries (split by newline for those)
          let allNotes = [];
          noteParts.forEach(part => {
            const trimmed = part.trim();
            if (!trimmed) return;
            if (trimmed.match(/^\[\d{1,2}\/\d{1,2}\/\d{2}\]/)) {
              // Dated note - keep as one entry (replace internal newlines with space)
              allNotes.push(trimmed.replace(/\n/g, ' '));
            } else {
              // Non-dated - split by newline
              trimmed.split('\n').forEach(line => {
                if (line.trim()) allNotes.push(line.trim());
              });
            }
          });

          // Filter out document entries and error messages only
          const noteLines = allNotes.filter(line => {
            const lower = line.toLowerCase();
            if (lower.includes('.pdf') ||
                lower.includes('error:') ||
                lower.includes('error analyzing') ||
                lower.includes('unexpected token') ||
                lower.includes('claude-sonnet') ||
                lower.includes('doctype')) return false;
            return true;
          });

          // If no notes, return null - the + Note button is now on the right
          if (!noteLines.length) {
            return null;
          }

          const deleteNote = async (e, lineToDelete) => {
            e.stopPropagation();
            const updatedLines = allNotes.filter(line => line !== lineToDelete);
            await onUpdate(borrower.id, { notes: updatedLines.join('\n') });
          };

          return (
            <div
              style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px 24px', flex: 1, marginLeft: '96px' }}
            >
              {noteLines.slice(0, 3).map((line, idx) => {
                // Try to parse [M/D/YY] prefix (date only, no time)
                const match = line.match(/^\[(\d{1,2}\/\d{1,2}\/\d{2})\]\s*(.*)$/);
                const dateStr = match ? match[1] : '';
                const noteText = match ? match[2] : line;
                return (
                  <div
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); onExpand(borrower.id, 'notes'); }}
                    style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '5px', cursor: 'pointer', maxWidth: '864px' }}
                    title={noteText}
                  >
                    <button
                      type="button"
                      onClick={(e) => deleteNote(e, line)}
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '11px', padding: '0 2px', flexShrink: 0 }}
                      title="Delete this note"
                    >x</button>
                    {dateStr && <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '600', flexShrink: 0, whiteSpace: 'nowrap' }}>{dateStr}</span>}
                    <span style={{ fontSize: '12px', color: '#cbd5e1', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {noteText}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Doc Drop Zone - right side */}
        <div>
          <InlineDocDrop borrower={borrower} onDocDrop={onDocDrop} onHighlight={setDropHighlight} />
        </div>

        {/* Preapproved indicators */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {borrower.val_approved && (
            <span title="VAL - Verified Approval Letter" style={{ background: '#22c55e', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '700' }}>VAL</span>
          )}
          {borrower.preapproval_sent && (
            <span title="Preapproval Letter Sent" style={{ background: '#3b82f6', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '700' }}>PA</span>
          )}
        </div>

        {/* Quick Note inline */}
        <QuickNoteInput borrower={borrower} onAddNote={onAddNote} />

        {/* Touch stamp - right side */}
        <span className={`touch-stamp ${touched ? 'touched' : ''}`} style={{ marginRight: '8px' }}>
          {touchLabel}
        </span>

        {/* Actions - clearer icons */}
        <div className="card-actions">
          <button type="button" className="btn-icon" onClick={() => onTouch(borrower.id)} title="Mark Touched">
            <Clock size={14} />
          </button>

          <button type="button" className="btn-icon" onClick={onOpenCalendar} title="Calendar">
            <Calendar size={14} />
          </button>

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn-icon"
              onClick={e => { e.stopPropagation(); setShowSummary(s => !s); }}
              title="Quick Summary"
            >
              <ArrowRight size={14} />
            </button>
            {showSummary && (
              <QuickSummaryPanel
                borrower={borrower}
                onMoveStage={(stage) => onMoveStage(borrower.id, stage, borrower.stage)}
                onClose={() => setShowSummary(false)}
              />
            )}
          </div>

          <button type="button" className="btn-icon" onClick={() => onEdit(borrower)} title="Edit Borrower">
            <Edit3 size={14} />
          </button>

          <button type="button" className="btn-icon" onClick={() => onDelete(borrower.id)} title="Delete" style={{ color: '#f87171', borderColor: '#7f1d1d' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Lender Row - only shows when expanded */}
      {isExpanded && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '8px 16px', marginLeft: '60px',
          background: '#1a1a28', borderBottom: '1px solid #2a2a40',
        }}>
          <span style={{ fontSize: '10px', color: '#6b6b8a', fontWeight: '600' }}>Lender:</span>
          <LenderBadge borrower={borrower} onUpdate={onUpdate} />

          {/* Tags inline */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <AddTagInline borrower={borrower} onAdd={(tag) => onAddTag(borrower.id, tag)} sc={STAGE_COLORS[borrower.stage]} />
            {tags.map(t => (
              <TagPill key={t.id} tag={t.tag} tagId={t.id} onRemove={onRemoveTag} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BorrowerRow;
