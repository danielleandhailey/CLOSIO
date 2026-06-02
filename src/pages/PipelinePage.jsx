import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, RefreshCw, Loader, Zap } from 'lucide-react';
import BorrowerRow from '../components/BorrowerRow';
import ExpandedCard from '../components/ExpandedCard';
import AddBorrowerModal from '../components/AddBorrowerModal';
import { STAGES, STAGE_COLORS, SORT_OPTIONS } from '../lib/constants';
import { sortBorrowers } from '../lib/utils';
import { bonzoService } from '../lib/bonzo';
import { format } from 'date-fns';

const PipelinePage = ({ borrowers, ops }) => {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filterStage, setFilterStage] = useState('All');
  const [sortBy, setSortBy] = useState('stage');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [bonzoPulling, setBonzoPulling] = useState(false);
  const [bonzoStatus, setBonzoStatus] = useState('');
  const [editingBorrower, setEditingBorrower] = useState(null);

  // Stage counts
  const stageCounts = useMemo(() => {
    const counts = {};
    STAGES.forEach(s => { counts[s] = 0; });
    borrowers.forEach(b => { if (counts[b.stage] !== undefined) counts[b.stage]++; });
    return counts;
  }, [borrowers]);

  // Filter + sort
  const displayedBorrowers = useMemo(() => {
    let list = borrowers;
    if (filterStage !== 'All') list = list.filter(b => b.stage === filterStage);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.name.toLowerCase().includes(q) ||
        (b.lender || '').toLowerCase().includes(q) ||
        (b.loan_type || '').toLowerCase().includes(q) ||
        (b.borrower_tags || []).some(t => t.tag.toLowerCase().includes(q))
      );
    }
    return sortBorrowers(list, sortBy, STAGES);
  }, [borrowers, filterStage, sortBy, search]);

  const handleSelect = useCallback((id, checked) => {
    setSelectedIds(s => {
      const n = new Set(s);
      checked ? n.add(id) : n.delete(id);
      return n;
    });
  }, []);

  const handleExpand = useCallback((id) => {
    setExpandedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const handleClose = useCallback((id) => {
    setExpandedIds(prev => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Delete this borrower? This cannot be undone.')) return;
    await ops.deleteBorrower(id);
    handleClose(id);
  }, [ops, handleClose]);

  const [cxldDialog, setCxldDialog] = useState(null); // { id, fromStage }

  const handleMoveStage = useCallback(async (id, newStage, fromStage) => {
    // Show reason dialog when moving to CXLD
    if (newStage === 'CXLD') {
      setCxldDialog({ id, fromStage });
      return;
    }
    try {
      await ops.moveBorrower(id, newStage, fromStage);
      const borrower = borrowers.find(b => b.id === id);
      if (borrower?.bonzo_id) {
        bonzoService.pushStageChange(borrower, newStage).catch(console.error);
      }
    } catch (e) {
      alert('Move failed: ' + e.message);
    }
  }, [ops, borrowers]);

  const handleCxldConfirm = async (reason) => {
    if (!cxldDialog) return;
    try {
      await ops.moveBorrower(cxldDialog.id, 'CXLD', cxldDialog.fromStage);
      if (reason) {
        const borrower = borrowers.find(b => b.id === cxldDialog.id);
        const notes = borrower?.notes || '';
        await ops.updateBorrower(cxldDialog.id, {
          notes: notes + `\n\n❌ CXLD (${new Date().toLocaleDateString()}): ${reason}`
        });
      }
    } catch (e) {
      alert('Move failed: ' + e.message);
    }
    setCxldDialog(null);
  };

  const handleBonzoPull = async () => {
    setBonzoPulling(true);
    setBonzoStatus('');
    try {
      const { added, updated } = await bonzoService.pullLeads();
      setBonzoStatus(`Pulled ${added} new, ${updated} updated — ${format(new Date(), 'MM/dd h:mma')}`);
    } catch (e) {
      setBonzoStatus(`Error: ${e.message}`);
    } finally {
      setBonzoPulling(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div className="toolbar">
        <select className="select-input" value={filterStage} onChange={e => setFilterStage(e.target.value)}>
          <option value="All">All Stages</option>
          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select className="select-input" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div style={{ position: 'relative', flex: 1, maxWidth: '240px' }}>
          <input
            className="search-input"
            type="text"
            placeholder="Search borrowers, tags, lender…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingRight: search ? '26px' : '10px' }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text3)', fontSize: '16px', lineHeight: 1, fontWeight: '700',
              }}
            >×</button>
          )}
        </div>

        {/* Bonzo Pull */}
        <button type="button" className="btn btn-ghost" onClick={handleBonzoPull} disabled={bonzoPulling} title="Sync leads from Bonzo CRM">
          {bonzoPulling ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={12} />}
          Bonzo Pull
        </button>

        {bonzoStatus && (
          <span className="bonzo-badge">{bonzoStatus}</span>
        )}

        <button type="button" className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowAddModal(true)}>
          <Plus size={13} /> Add Borrower
        </button>
      </div>

      {/* Stage counts bar */}
      <div className="stage-bar">
        <button
          type="button"
          className={`stage-pill ${filterStage === 'All' ? 'active' : ''}`}
          style={{ background: '#22222e', color: '#a0a0b8', border: '1px solid #333345' }}
          onClick={() => setFilterStage('All')}
        >
          All <span style={{ marginLeft: '3px', fontWeight: '700' }}>{borrowers.length}</span>
        </button>
        {STAGES.map(s => {
          const c = STAGE_COLORS[s];
          const count = stageCounts[s] || 0;
          return (
            <button
              key={s}
              type="button"
              className={`stage-pill ${filterStage === s ? 'active' : ''}`}
              style={{ background: c.bg, color: c.text, opacity: count === 0 ? 0.4 : 1 }}
              onClick={() => setFilterStage(prev => prev === s ? 'All' : s)}
            >
              {s} <span style={{ marginLeft: '3px', fontWeight: '700' }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Pipeline list */}
      <div className="pipeline-content">
        <div className="borrower-list">
          {displayedBorrowers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6a6a80' }}>
              {search || filterStage !== 'All'
                ? 'No borrowers match your filters.'
                : 'No borrowers yet. Click "Add Borrower" to get started.'}
            </div>
          )}

          {displayedBorrowers.map(borrower => (
            <React.Fragment key={borrower.id}>
              <BorrowerRow
                borrower={borrower}
                isExpanded={expandedIds.has(borrower.id)}
                isSelected={selectedIds.has(borrower.id)}
                onSelect={handleSelect}
                onExpand={handleExpand}
                onEdit={setEditingBorrower}
                onDelete={handleDelete}
                onTouch={ops.touchBorrower}
                onMoveStage={handleMoveStage}
                onAddTag={ops.addTag}
                onRemoveTag={ops.removeTag}
                onOpenCalendar={() => {}} // handled at app level
                onUpdate={ops.updateBorrower}
              />
              {expandedIds.has(borrower.id) && (
                <ExpandedCard borrower={borrower} ops={ops} onClose={() => handleClose(borrower.id)} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* CXLD Reason Dialog */}
      {cxldDialog && (
        <CxldDialog
          borrower={borrowers.find(b => b.id === cxldDialog.id)}
          onConfirm={handleCxldConfirm}
          onCancel={() => setCxldDialog(null)}
        />
      )}

      {/* Add Borrower Modal */}
      {showAddModal && (
        <AddBorrowerModal
          onClose={() => setShowAddModal(false)}
          onSave={ops.addBorrower}
        />
      )}

      {/* Edit Modal (reuses Add modal) */}
      {editingBorrower && (
        <EditBorrowerModal
          borrower={editingBorrower}
          onClose={() => setEditingBorrower(null)}
          onSave={async (data) => {
            await ops.updateBorrower(editingBorrower.id, data);
            setEditingBorrower(null);
          }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// CXLD Reason Dialog
const CxldDialog = ({ borrower, onConfirm, onCancel }) => {
  const [reason, setReason] = React.useState('');
  const REASONS = ['DNQ - Credit', 'DNQ - Income', 'DNQ - DTI', 'Property Issue', 'Borrower Withdrew', 'Went with Another Lender', 'Could Not Contact', 'Other'];

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '420px' }}>
        <div className="modal-title">
          ❌ Cancel — {borrower?.name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
          Select a reason for cancelling this borrower.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
          {REASONS.map(r => (
            <button key={r} type="button"
              onClick={() => setReason(r)}
              style={{
                padding: '8px 12px', borderRadius: '6px', border: '1px solid',
                borderColor: reason === r ? '#ef4444' : 'var(--border)',
                background: reason === r ? '#fee2e2' : 'var(--surface2)',
                color: reason === r ? '#991b1b' : 'var(--text)',
                cursor: 'pointer', fontSize: '12px', fontWeight: reason === r ? '700' : '400',
                textAlign: 'left',
              }}
            >{r}</button>
          ))}
        </div>
        <div style={{ marginBottom: '12px' }}>
          <textarea
            placeholder="Additional notes (optional)…"
            value={reason && !REASONS.includes(reason) ? reason : ''}
            onChange={e => setReason(e.target.value)}
            style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px', borderRadius: '6px', fontSize: '12px', minHeight: '60px', outline: 'none', resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={() => onConfirm(reason)}
            style={{ flex: 1, padding: '9px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            ❌ Confirm Cancel
          </button>
          <button type="button" onClick={onCancel}
            style={{ padding: '9px 16px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
            Keep Active
          </button>
        </div>
      </div>
    </div>
  );
};

// Simple edit modal wrapper
const EditBorrowerModal = ({ borrower, onClose, onSave }) => {
  return (
    <AddBorrowerModal
      onClose={onClose}
      onSave={onSave}
      initialData={borrower}
      title="Edit Borrower"
    />
  );
};

export default PipelinePage;
