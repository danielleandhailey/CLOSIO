import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus } from 'lucide-react';
import BorrowerRow from '../components/BorrowerRow';
import ExpandedCard from '../components/ExpandedCard';
import AddBorrowerModal from '../components/AddBorrowerModal';
import DashboardHeader from '../components/DashboardHeader';
import { STAGES, STAGES_BY_TYPE, STAGE_COLORS, SORT_OPTIONS } from '../lib/constants';
import { sortBorrowers } from '../lib/utils';

const PipelinePage = ({ borrowers, ops }) => {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [defaultTab, setDefaultTab] = useState(null); // which tab to open by default
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filterType, setFilterType] = useState('All'); // Loan type filter
  const [filterStage, setFilterStage] = useState('All');
  const [sortBy, setSortBy] = useState('stage');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBorrower, setEditingBorrower] = useState(null);

  const LOAN_TYPES = ['All', 'Purchase', 'Refinance', 'HELOC', 'Reverse', 'Refi/HELOC', 'DSCR', 'Bank Statement', 'VA', 'FHA', 'Conventional', 'Jumbo', 'Non-QM', 'DPA', 'OTC'];

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
    // Filter by loan type
    if (filterType !== 'All') {
      list = list.filter(b => {
        const loanType = (b.loan_type || '').toLowerCase();
        const loanPurpose = (b.loan_purpose || '').toLowerCase();
        // Handle combo filter
        if (filterType === 'Refi/HELOC') {
          return loanType.includes('refi') || loanPurpose.includes('refi') ||
                 loanType.includes('heloc') || loanPurpose.includes('heloc');
        }
        const filterLower = filterType.toLowerCase();
        return loanType.includes(filterLower) || loanPurpose.includes(filterLower);
      });
    }
    // Filter by stage
    if (filterStage !== 'All') list = list.filter(b => b.stage === filterStage);
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.name.toLowerCase().includes(q) ||
        (b.lender || '').toLowerCase().includes(q) ||
        (b.loan_type || '').toLowerCase().includes(q) ||
        (b.phone || '').toLowerCase().includes(q) ||
        (b.email || '').toLowerCase().includes(q) ||
        (b.borrower_tags || []).some(t => t.tag.toLowerCase().includes(q))
      );
    }
    return sortBorrowers(list, sortBy, STAGES);
  }, [borrowers, filterType, filterStage, sortBy, search]);

  const handleSelect = useCallback((id, checked) => {
    setSelectedIds(s => {
      const n = new Set(s);
      checked ? n.add(id) : n.delete(id);
      return n;
    });
  }, []);

  const handleExpand = useCallback((id, openTab = null) => {
    setDefaultTab(openTab);
    setExpandedIds(prev => {
      // If clicking on same one, toggle it off
      if (prev.has(id)) {
        const n = new Set(prev);
        n.delete(id);
        return n;
      }
      // Otherwise close all others and open this one (auto-close previous)
      return new Set([id]);
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
    } catch (e) {
      alert('Move failed: ' + e.message);
    }
  }, [ops]);

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


  const handleSelectBorrower = useCallback((id, openTab = null) => {
    if (openTab) setDefaultTab(openTab);
    setExpandedIds(new Set([id]));
    // Scroll to borrower
    setTimeout(() => {
      document.getElementById(`borrower-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Dashboard Header */}
      <DashboardHeader
        borrowers={borrowers}
        onSelectBorrower={handleSelectBorrower}
        onFilterStage={setFilterStage}
        ops={ops}
        onToggleTask={(id, completed) => ops.updateTask(id, { completed })}
        onDeleteTask={(id) => ops.deleteTask(id)}
      />

      {/* Toolbar */}
      <div className="toolbar">
        {/* Type filter */}
        <select className="select-input" value={filterType} onChange={e => setFilterType(e.target.value)}>
          {LOAN_TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
        </select>

        {/* Stage filter */}
        <select className="select-input" value={filterStage} onChange={e => setFilterStage(e.target.value)}>
          <option value="All">Stages</option>
          {(STAGES_BY_TYPE[filterType] || STAGES).map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Sort */}
        <select className="select-input" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="stage">Sort</option>
          {SORT_OPTIONS.filter(o => o.value !== 'stage').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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

        <button type="button" className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => window.dispatchEvent(new CustomEvent('openMatrix'))}>
          🗂 Matrix
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={13} /> Add Borrower
        </button>
      </div>

      {/* Stage counts bar */}
      <div className="stage-bar">
        <button
          type="button"
          className={`stage-pill ${filterStage === 'All' ? 'active' : ''}`}
          style={{ background: '#22222e', color: '#a0a0b8', border: '1px solid #333345' }}
          onClick={() => { setFilterStage('All'); setSearch(''); }}
        >
          All <span style={{ marginLeft: '3px', fontWeight: '700' }}>{borrowers.length}</span>
        </button>
        {(STAGES_BY_TYPE[filterType] || STAGES).map(s => {
          const c = STAGE_COLORS[s];
          const count = stageCounts[s] || 0;
          return (
            <button
              key={s}
              type="button"
              className={`stage-pill ${filterStage === s ? 'active' : ''}`}
              style={{ background: c.bg, color: c.text, opacity: count === 0 ? 0.4 : 1 }}
              onClick={() => { setFilterStage(prev => prev === s ? 'All' : s); setSearch(''); }}
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
              <div id={`borrower-${borrower.id}`}>
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
                onDocDrop={(id) => handleExpand(id)} // expand card to use existing doc drop
                onAddNote={ops.addNote}
              />
              {expandedIds.has(borrower.id) && (
                <ExpandedCard borrower={borrower} ops={ops} onClose={() => handleClose(borrower.id)} defaultTab={defaultTab} />
              )}
              </div>
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
