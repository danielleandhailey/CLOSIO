import React, { useMemo, useState } from 'react';

const digits = (s) => (s || '').replace(/\D/g, '');
const lastName = (n) => (n || '').toLowerCase().split(',')[0].replace(/[^a-z]/g, '').trim();
const firstName = (n) => ((n || '').toLowerCase().split(',')[1] || '').replace(/[^a-z\s]/g, ' ').trim();
const recency = (b) => new Date(b.updated_at || b.last_touched || b.created_at || 0).getTime();
const recencyLabel = (b) => {
  const t = recency(b);
  return t ? new Date(t).toLocaleDateString() : '—';
};

const sameContact = (a, b) => {
  const pa = digits(a.phone), pb = digits(b.phone);
  const ea = (a.email || '').toLowerCase().trim(), eb = (b.email || '').toLowerCase().trim();
  return (pa && pa === pb) || (ea && ea === eb);
};

// Two records look like the same borrower?
const candidate = (a, b) => {
  if (sameContact(a, b)) return true;
  const la = lastName(a.name), lb = lastName(b.name);
  if (!la || la !== lb) return false;            // different last name -> not a dupe
  const fa = firstName(a.name), fb = firstName(b.name);
  if (!fa || !fb) return true;                   // one has no first name
  const ta = fa.split(/\s+/)[0], tb = fb.split(/\s+/)[0];
  if (ta === tb) return true;                     // same first name
  if (ta[0] === tb[0] && (ta.length === 1 || tb.length === 1)) return true; // initial match
  return false;
};

const buildGroups = (borrowers) => {
  const parent = {};
  const find = (x) => (parent[x] === undefined ? (parent[x] = x) : (parent[x] === x ? x : (parent[x] = find(parent[x]))));
  const union = (a, b) => { parent[find(a)] = find(b); };
  borrowers.forEach(b => find(b.id));
  for (let i = 0; i < borrowers.length; i++) {
    for (let j = i + 1; j < borrowers.length; j++) {
      if (candidate(borrowers[i], borrowers[j])) union(borrowers[i].id, borrowers[j].id);
    }
  }
  const map = {};
  borrowers.forEach(b => { const r = find(b.id); (map[r] = map[r] || []).push(b); });
  return Object.values(map)
    .filter(g => g.length > 1)
    .map(g => g.slice().sort((a, b) => recency(b) - recency(a))); // newest first
};

const DedupModal = ({ borrowers, onMerge, onClose }) => {
  const groups = useMemo(() => buildGroups(borrowers), [borrowers]);
  const [winners, setWinners] = useState({});   // groupId -> winnerId
  const [excluded, setExcluded] = useState({}); // borrowerId -> true (leave it out)
  const [busy, setBusy] = useState(null);

  const winnerOf = (g) => winners[g[0].id] || g[0].id; // default = most recent

  const doMerge = async (g) => {
    const winnerId = winnerOf(g);
    const losers = g.filter(b => b.id !== winnerId && !excluded[b.id]).map(b => b.id);
    if (!losers.length) return;
    const wName = g.find(b => b.id === winnerId)?.name;
    if (!window.confirm(`Merge ${losers.length} record(s) into "${wName}"?\nBlanks fill from the others, their docs/notes move over, then the extras are removed.`)) return;
    setBusy(g[0].id);
    try { await onMerge(winnerId, losers); } catch (e) { alert('Merge failed: ' + e.message); }
    setBusy(null);
  };

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const panel = { background: '#15151f', border: '1px solid #3a3a55', borderRadius: '12px', width: 'min(720px, 94vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #3a3a55', display: 'flex', alignItems: 'center' }}>
          <div style={{ color: '#f0f0ff', fontWeight: 800, fontSize: '15px' }}>🧹 Duplicate Borrowers</div>
          <div style={{ color: '#8080a8', fontSize: '12px', marginLeft: '10px' }}>{groups.length} group{groups.length === 1 ? '' : 's'} found</div>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Close</button>
        </div>

        <div style={{ padding: '14px 18px', overflowY: 'auto' }}>
          {groups.length === 0 && (
            <div style={{ color: '#8080a8', textAlign: 'center', padding: '30px', fontSize: '13px' }}>No duplicates found. 🎉</div>
          )}

          {groups.map(g => {
            const winnerId = winnerOf(g);
            return (
              <div key={g[0].id} style={{ border: '1px solid #3a3a55', borderRadius: '10px', padding: '10px', marginBottom: '12px', background: '#1c1c28' }}>
                <div style={{ fontSize: '10px', color: '#8080a8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Keep one (○), uncheck any that's a different person
                </div>
                {g.map(b => {
                  const isWinner = b.id === winnerId;
                  const isOut = !!excluded[b.id];
                  return (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', borderTop: '1px solid #2a2a3a', opacity: isOut ? 0.4 : 1 }}>
                      <input type="radio" name={`w-${g[0].id}`} checked={isWinner} disabled={isOut}
                        onChange={() => setWinners(w => ({ ...w, [g[0].id]: b.id }))} title="Keep this one" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#f0f0ff', fontWeight: 700, fontSize: '13px' }}>
                          {b.name} {isWinner && <span style={{ color: '#22c55e', fontSize: '10px', fontWeight: 700 }}>KEEP</span>}
                        </div>
                        <div style={{ color: '#9a9ab8', fontSize: '11px' }}>
                          {b.stage || '—'} · {b.phone || 'no phone'} · {b.email || 'no email'} · last {recencyLabel(b)}
                        </div>
                      </div>
                      {!isWinner && (
                        <label style={{ fontSize: '10px', color: '#9a9ab8', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!isOut}
                            onChange={() => setExcluded(x => ({ ...x, [b.id]: isOut ? undefined : true }))} />
                          merge
                        </label>
                      )}
                    </div>
                  );
                })}
                <button type="button" disabled={busy === g[0].id} onClick={() => doMerge(g)}
                  style={{ marginTop: '10px', width: '100%', padding: '8px', borderRadius: '6px', background: busy === g[0].id ? '#475569' : '#8b4cf7', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 800 }}>
                  {busy === g[0].id ? 'Merging…' : 'Merge this group'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DedupModal;
