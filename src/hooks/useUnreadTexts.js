import { useState, useEffect, useCallback } from 'react';

// Polls Bonzo (via /api/bonzo-unread) for new inbound texts and tracks which
// borrowers (by bonzo_id / prospect id) have an UNREAD text. "Read" state is
// kept per-browser in localStorage so the pink dot clears when YOU open the
// thread in CLOSIO, and re-lights only when a newer text arrives.
const SEEN_KEY = 'closio_text_seen';
const loadSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; } };

export const useUnreadTexts = (intervalMs = 15000) => {
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState(loadSeen);

  const poll = useCallback(async () => {
    try {
      const r = await fetch('/api/bonzo-unread');
      const d = await r.json();
      if (Array.isArray(d.items)) setItems(d.items);
    } catch (e) { /* ignore network blips */ }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, intervalMs);
    return () => clearInterval(id);
  }, [poll, intervalMs]);

  const unreadIds = new Set(
    items
      .filter(it => it.unread && it.lastAt && (!seen[it.prospectId] || new Date(it.lastAt) > new Date(seen[it.prospectId])))
      .map(it => it.prospectId)
  );

  const markSeen = useCallback((prospectId) => {
    if (!prospectId) return;
    const pid = String(prospectId);
    const it = items.find(x => x.prospectId === pid);
    const ts = it?.lastAt || new Date().toISOString();
    setSeen(s => {
      const n = { ...s, [pid]: ts };
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(n)); } catch (e) { /* ignore */ }
      return n;
    });
  }, [items]);

  return { unreadIds, markSeen };
};
