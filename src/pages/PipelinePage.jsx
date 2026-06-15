import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Plus, Zap } from 'lucide-react';
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

  // Drag-to-reorder stage pills; order is saved per browser and persists across reopens
  const [stageOrder, setStageOrder] = useState(() => {
    try { const s = localStorage.getItem('closio_stage_order'); if (s) return JSON.parse(s); } catch (e) { /* ignore */ }
    return STAGES;
  });
  const dragStage = useRef(null);
  const orderedStages = useMemo(() => {
    const base = STAGES_BY_TYPE[filterType] || STAGES;
    const idx = (s) => { const i = stageOrder.indexOf(s); return i < 0 ? 999 : i; };
    return [...base].sort((a, b) => idx(a) - idx(b));
  }, [filterType, stageOrder]);
  const handleStageDrop = (target) => {
    const from = dragStage.current;
    dragStage.current = null;
    if (!from || from === target) return;
    const cur = [...orderedStages];
    const fromI = cur.indexOf(from), toI = cur.indexOf(target);
    if (fromI < 0 || toI < 0) return;
    cur.splice(toI, 0, cur.splice(fromI, 1)[0]);
    const full = [...new Set([...cur, ...stageOrder, ...STAGES])];
    setStageOrder(full);
    try { localStorage.setItem('closio_stage_order', JSON.stringify(full)); } catch (e) { /* ignore */ }
  };

  // Auto Bonzo sync at startup and every 15 minutes
  useEffect(() => {
    let mounted = true;
    const doSync = async () => {
      try {
        const res = await fetch('/api/bonzo-pull');
        const data = await res.json();
        if (mounted && (data.created > 0 || data.updated > 0)) {
          console.log('Auto Bonzo sync:', data);
          if (ops.refresh) ops.refresh();
        }
      } catch (e) {
        console.error('Auto Bonzo sync error:', e);
      }
    };
    doSync(); // Run at startup
    const interval = setInterval(doSync, 15 * 60 * 1000); // Every 15 min
    return () => { mounted = false; clearInterval(interval); };
  }, [ops]);

  const LOAN_TYPES = ['All', 'Purchase', 'Refinance', 'HELOC', 'Reverse', 'Refi/HELOC', 'DSCR', 'Bank Statement', 'VA', 'FHA', 'Conventional', 'Jumbo', 'Non-QM', 'DPA', 'OTC'];

  // Stage counts (special handling for Stips Needed and Updated)
  const stageCounts = useMemo(() => {
    const counts = {};
    STAGES.forEach(s => { counts[s] = 0; });
    borrowers.forEach(b => {
      // Stips Needed: count borrowers with stips_needed > 0
      if (b.stage === 'Stips Needed' || (b.stips_needed && b.stips_needed > 0)) {
        counts['Stips Needed']++;
      }
      // Updated: count borrowers with is_updated flag
      if (b.is_updated) {
        counts['Updated']++;
      }
      // Normal stage counting (skip Stips Needed and Updated since handled above)
      if (counts[b.stage] !== undefined && b.stage !== 'Stips Needed' && b.stage !== 'Updated') {
        counts[b.stage]++;
      }
    });
    counts['NEW'] = borrowers.filter(b => b.is_new).length;
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
    // Filter by stage (special handling for Stips Needed and Updated)
    if (filterStage !== 'All') {
      if (filterStage === 'NEW') {
        list = list.filter(b => b.is_new);
      } else if (filterStage === 'Stips Needed') {
        list = list.filter(b => b.stage === 'Stips Needed' || (b.stips_needed && b.stips_needed > 0));
      } else if (filterStage === 'Updated') {
        list = list.filter(b => b.is_updated);
      } else if (filterStage === 'W/Competitor') {
        list = list.filter(b => b.stage === 'W/Competitor' || b.stage === 'Went With Competitor');
      } else {
        list = list.filter(b => b.stage === filterStage);
      }
    }
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

        <div style={{ position: 'relative', marginLeft: 'auto' }} className="nav-dropdown">
          <button type="button" className="btn btn-ghost">
            Property Hub ▾
          </button>
          <div className="dropdown-menu" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <button onClick={() => window.open('https://zillow.com', '_blank')}>Zillow</button>
            <button onClick={() => window.open('https://www.redfin.com', '_blank')}>Redfin</button>
            <button onClick={() => window.open('https://app.rocketpro.com/property-hub', '_blank')}>Property Hub</button>
            <button onClick={() => window.open('https://v3.titlepro247.com/Account', '_blank')}>TitlePro247</button>
            <button onClick={() => window.open('https://homeinsurance.wcl.com', '_blank')}>Home Insurance Lookup</button>
            <button onClick={() => window.open('https://www.fhfa.gov/DataTools/Downloads/Pages/Conforming-Loan-Limit.aspx', '_blank')}>FHFA Loan Limits</button>
            <button onClick={() => window.open('https://www.huduser.gov/portal/datasets/il.html', '_blank')}>HUD AMI Lookup</button>
            <button onClick={() => window.open('https://entp.hud.gov/idapp/html/hicostlook.cfm', '_blank')}>FHA Mortgage Limits</button>
            <button onClick={() => window.open('https://msc.fema.gov/portal/home', '_blank')}>FEMA Flood Map</button>
            <button onClick={() => window.open('https://osfm.fire.ca.gov/divisions/community-wildfire-preparedness-and-mitigation/wildland-hazards-building-codes/fire-hazard-severity-zones-maps/', '_blank')}>CalFire Hazard Maps</button>
            <button onClick={() => window.open('https://singlefamily.fanniemae.com/', '_blank')}>Fannie Mae Guidelines</button>
            <button onClick={() => window.open('https://guide.freddiemac.com/', '_blank')}>Freddie Mac Guide</button>
          </div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => window.open('https://teams.microsoft.com', '_blank')}>
          Teams
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => window.open('https://app.ringcentral.com', '_blank')}>
          Ring
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => window.open('https://app.getbonzo.com', '_blank')}>
          Bonzo
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => window.open('https://westcaplending-my.sharepoint.com/personal/dregnier_westcapitallending_com/Documents/Brokerflow/Closer%20Ultra%20Template%20V6-Danielle.xlsm?web=1', '_blank')}>
          BrokerFlow
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => window.dispatchEvent(new CustomEvent('openMatrix'))}>
          🗂 Matrix
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={13} /> Add Borrower
        </button>
      </div>

      {/* Stage counts bar */}
      <div className="stage-bar">
        <input
          type="checkbox"
          onChange={e => {
            if (e.target.checked) setSelectedIds(new Set(displayedBorrowers.map(b => b.id)));
            else setSelectedIds(new Set());
          }}
          checked={selectedIds.size > 0 && selectedIds.size === displayedBorrowers.length}
          title="Select All"
          style={{ width: '14px', height: '14px', cursor: 'pointer', marginRight: '12px', marginLeft: '0px' }}
        />
        <button
          type="button"
          className={`stage-pill ${filterStage === 'All' ? 'active' : ''}`}
          style={{ background: '#22222e', color: '#a0a0b8', border: '1px solid #333345' }}
          onClick={() => { setFilterStage('All'); setSearch(''); }}
        >
          All <span style={{ marginLeft: '3px', fontWeight: '700' }}>{borrowers.length}</span>
        </button>
        <div style={{ width: '2px', alignSelf: 'stretch', background: '#3a3a55', borderRadius: '2px', margin: '0 16px 0 110px', flexShrink: 0 }} />
        <button
          type="button"
          className={`stage-pill ${filterStage === 'NEW' ? 'active' : ''}`}
          style={{ background: '#f9a8d4', color: '#000', opacity: (stageCounts['NEW'] || 0) === 0 ? 0.4 : 1 }}
          onClick={() => { setFilterStage(prev => prev === 'NEW' ? 'All' : 'NEW'); setSearch(''); }}
        >
          NEW <span style={{ marginLeft: '3px', fontWeight: '700' }}>{stageCounts['NEW'] || 0}</span>
        </button>
        {orderedStages.map(s => {
          const c = STAGE_COLORS[s];
          const count = stageCounts[s] || 0;
          return (
            <button
              key={s}
              type="button"
              className={`stage-pill ${filterStage === s ? 'active' : ''}`}
              style={{ background: c.bg, color: c.text, opacity: count === 0 ? 0.4 : 1, cursor: 'grab' }}
              draggable
              onDragStart={() => { dragStage.current = s; }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleStageDrop(s)}
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
                onAddStip={ops.addStipulation}
                onMarkStipReceived={ops.markStipReceived}
                onRemoveStip={ops.removeStipulation}
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
