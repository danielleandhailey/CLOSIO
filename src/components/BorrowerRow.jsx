import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Pencil, Trash2, Calendar, ArrowRight, Plus, Clock } from 'lucide-react';
import { STAGE_COLORS, STAGES, PRESET_TAGS } from '../lib/constants';
import { formatDate, formatCurrency, formatRate, calcPI, calcLTV, getTagStyle, touchedRecently } from '../lib/utils';
import { format, parseISO } from 'date-fns';

// Quick Summary Panel
const QuickSummaryPanel = ({ borrower, onMoveStage, onClose, ops }) => {
  const [showStageSelect, setShowStageSelect] = useState(false);
  const panelRef = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const pi = calcPI(borrower.loan_amount, borrower.rate);
  const ltv = calcLTV(borrower.loan_amount, borrower.purchase_price);
  const sc = STAGE_COLORS[borrower.stage] || STAGE_COLORS['Working'];

  return (
    <div ref={panelRef} className="quick-summary-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#6a6a80', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick Summary</span>
        <span className="stage-badge" style={{ background: sc.bg, color: sc.text }}>{borrower.stage}</span>
      </div>

      <div className="summary-grid">
        {[
          ['Purchase Price', formatCurrency(borrower.purchase_price)],
          ['Loan Amount',    formatCurrency(borrower.loan_amount)],
          ['Loan Type',      borrower.loan_type || '—'],
          ['Occupancy',      borrower.occupancy || '—'],
          ['Rate',           formatRate(borrower.rate)],
          ['P&I / mo',       pi ? formatCurrency(pi) : '—'],
          ['LTV',            ltv ? `${ltv}%` : (borrower.ltv ? `${borrower.ltv}%` : '—')],
          ['DTI',            borrower.dti ? `${borrower.dti}%` : '—'],
          ['Income Type',    borrower.income_type || '—'],
          ['Seller CC',      formatCurrency(borrower.seller_cc)],
          ['COE Date',       formatDate(borrower.coe_date)],
          ['Lender',         borrower.lender || '—'],
          ['Lock Status',    borrower.rate_status || '—'],
          ['Stage',          borrower.stage],
        ].map(([label, value]) => (
          <div key={label} className="summary-item">
            <label>{label}</label>
            <span>{value}</span>
          </div>
        ))}
      </div>

      {showStageSelect ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#6a6a80', marginBottom: '4px' }}>Move to Stage</div>
          {STAGES.filter(s => s !== borrower.stage).map(s => {
            const c = STAGE_COLORS[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => { onMoveStage(s); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 10px', borderRadius: '5px', border: 'none',
                  background: c.bg, color: c.bg === '#fff' ? c.text : '#000',
                  cursor: 'pointer', fontSize: '12px', fontWeight: '600', textAlign: 'left',
                }}
              >
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: c.bg === '#fff' ? c.text : c.bg,
                  flexShrink: 0,
                }} />
                {s}
              </button>
            );
          })}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowStageSelect(false)} style={{ marginTop: '4px' }}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => setShowStageSelect(true)}>
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
