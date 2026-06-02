import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Trash2, Clock } from 'lucide-react';
import { STAGE_COLORS, STAGES, PRESET_TAGS } from '../lib/constants';
import { formatCurrency, formatRate, calcPI, calcLTV, getTagStyle, touchedRecently } from '../lib/utils';
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
    await supabase.from('borrowers').update({ notes: updated, last_touched: new Date().toISOString() }).eq('id', borrower.id);
    setNote('');
    setSaving(false);
    // Refresh happens via realtime subscription
  };

  return (
    <div ref={panelRef} className="quick-summary-panel" style={{ width: '340px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: '800', color: '#f0f0ff' }}>{borrower.name}</span>
        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '800', background: sc.bg, color: sc.text, textTransform: 'uppercase' }}>
          {borrower.stage}
        </span>
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

// Inline add tag
const AddTagInline = ({ borrower, onAdd, sc }) => {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const existingTags = (borrower.borrower_tags || []).map(t => t.tag);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{
          padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
          border: '1px solid #60a5fa',
          background: '#1e3a5f',
          color: '#93c5fd',
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        + Tag
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 300,
          background: '#fff', border: '1px solid #ddd', borderRadius: '8px',
          padding: '10px', minWidth: '200px', boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
        }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>Preset Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
            {PRESET_TAGS.filter(t => !existingTags.includes(t.label)).map(t => (
              <button
                key={t.label}
                type="button"
                style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer', background: t.bg, color: t.color }}
                onClick={() => { onAdd(t.label); setOpen(false); }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>Custom Tag</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) { onAdd(custom.trim()); setCustom(''); setOpen(false); } }}
              placeholder="Type & press Enter…"
              style={{ flex: 1, background: '#f5f5f5', border: '1px solid #ddd', color: '#333', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
            />
            <button type="button" onClick={() => { if (custom.trim()) { onAdd(custom.trim()); setCustom(''); setOpen(false); } }}
              style={{ padding: '4px 10px', background: '#8b4cf7', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Lender badge with dropdown
const LENDER_OPTIONS = ['Rocket', 'PRMG', 'UWM', 'PennyMac', 'Click & Close', 'LoanDepot', 'Flagstar', 'NewRez', 'Freedom', 'Other'];

const LenderBadge = ({ borrower, onUpdate }) => {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const ref = useRef();
  const lender = borrower.lender;

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
          padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
          border: lender ? '1px solid #60a5fa' : '1px dashed #50507a',
          background: lender ? '#1e3a5f' : 'transparent',
          color: lender ? '#93c5fd' : '#8080a8',
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        {lender || '+ Lender'}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 300,
          background: '#fff', border: '1px solid #ddd', borderRadius: '8px',
          padding: '8px', minWidth: '170px', boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
        }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>Select Lender</div>
          {LENDER_OPTIONS.map(l => (
            <button key={l} type="button"
              onClick={e => { e.stopPropagation(); onUpdate(borrower.id, { lender: l }); setOpen(false); }}
              style={{ display: 'block', width: '100%', padding: '6px 10px', border: 'none', background: borrower.lender === l ? '#ede9fe' : 'transparent', color: borrower.lender === l ? '#6d28d9' : '#333', cursor: 'pointer', borderRadius: '4px', fontSize: '12px', fontWeight: borrower.lender === l ? '700' : '500', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={e => e.currentTarget.style.background = borrower.lender === l ? '#ede9fe' : 'transparent'}
            >
              {l}
            </button>
          ))}
          <div style={{ borderTop: '1px solid #eee', marginTop: '6px', paddingTop: '6px' }}>
            <input
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) { onUpdate(borrower.id, { lender: custom.trim() }); setCustom(''); setOpen(false); } }}
              placeholder="Other lender…"
              style={{ width: '100%', background: '#f5f5f5', border: '1px solid #ddd', color: '#333', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', outline: 'none' }}
            />
          </div>
        </div>
      )}
    </div>
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

// Main condensed row
const BorrowerRow = ({
  borrower, isExpanded, isSelected,
  onSelect, onExpand, onEdit, onDelete,
  onTouch, onMoveStage, onAddTag, onRemoveTag,
  onOpenCalendar, onUpdate,
}) => {
  const [showSummary, setShowSummary] = useState(false);
  const tags = borrower.borrower_tags || [];
  const touched = touchedRecently(borrower.last_touched);

  const touchLabel = borrower.last_touched
    ? format(typeof borrower.last_touched === 'string' ? parseISO(borrower.last_touched) : borrower.last_touched, 'M/d')
    : '—';

  return (
    <div style={{ position: 'relative' }}>
      <div className={`borrower-row ${isExpanded ? 'expanded' : ''}`}>
        {/* Checkbox */}
        <input type="checkbox" className="borrower-checkbox" checked={isSelected} onChange={e => onSelect(borrower.id, e.target.checked)} />

        {/* Stage dropdown */}
        <StageDropdown borrower={borrower} onMoveStage={onMoveStage} />

        {/* Expand toggle — right after stage for easy access */}
        <button
          type="button"
          onClick={() => onExpand(borrower.id)}
          title="Expand / Collapse"
          style={{
            width: '26px', height: '26px', borderRadius: '5px', border: '1px solid #50507a',
            background: isExpanded ? '#8b4cf7' : '#28283a', color: '#fff',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: '13px', fontWeight: '900', transition: 'all 0.15s',
          }}
        >
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {/* Name */}
        <span className="borrower-name">{borrower.name}</span>

        {/* Tags */}
        <div className="tags-row">
          {tags.map(t => (
            <TagPill key={t.id} tag={t.tag} tagId={t.id} onRemove={onRemoveTag} />
          ))}
          <AddTagInline borrower={borrower} onAdd={(tag) => onAddTag(borrower.id, tag)} sc={STAGE_COLORS[borrower.stage]} />
          <LenderBadge borrower={borrower} onUpdate={onUpdate} />
        </div>

        {/* Touch stamp */}
        <span className={`touch-stamp ${touched ? 'touched' : ''}`}>
          {touchLabel}
        </span>

        {/* Actions */}
        <div className="card-actions">
          <button type="button" className="btn-xs btn-ghost" onClick={() => onTouch(borrower.id)} title="Touch">
            <Clock size={10} style={{ marginRight: '2px' }} />touch
          </button>

          <button type="button" className="btn-icon" onClick={onOpenCalendar} title="Calendar">📅</button>

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn-icon"
              onClick={e => { e.stopPropagation(); setShowSummary(s => !s); }}
              title="Quick Summary"
            >→</button>
            {showSummary && (
              <QuickSummaryPanel
                borrower={borrower}
                onMoveStage={(stage) => onMoveStage(borrower.id, stage, borrower.stage)}
                onClose={() => setShowSummary(false)}
              />
            )}
          </div>

          <button type="button" className="btn-icon" onClick={() => onEdit(borrower)} title="Edit">✏</button>

          <button type="button" className="btn-icon" onClick={() => onDelete(borrower.id)} title="Delete" style={{ color: '#f87171', borderColor: '#7f1d1d' }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BorrowerRow;
