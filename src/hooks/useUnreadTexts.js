import { useState, useEffect, useCallback, useMemo } from 'react';

// Polls Bonzo (via /api/bonzo-unread) for conversations with unread (new
// inbound) texts. Matches a CLOSIO borrower to a Bonzo conversation by
// bonzo_id, phone, or email. "Read" state is kept per-browser in localStorage
// so the pink dot clears when YOU open the thread in CLOSIO and re-lights only
// when a newer text arrives.
const SEEN_KEY = 'closio_text_seen';
const loadSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; } };
const tenDigits = (s) => (s || '').replace(/\D/g, '').slice(-10);
const lc = (s) => (s || '').toLowerCase().trim();

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

  // Conversations that are unread AND newer than what we've marked seen here.
  const freshUnread = useMemo(() => items.filter(it =>
    it.unread && it.lastAt && (!seen[it.prospectId] || new Date(it.lastAt) > new Date(seen[it.prospectId]))
  ), [items, seen]);

  // Lookup keys (id / phone / email) so a borrower can match by any of them.
  const keys = useMemo(() => {
    const s = new Set();
    freshUnread.forEach(c => {
      if (c.prospectId) s.add('id:' + c.prospectId);
      if (c.phone) s.add('ph:' + c.phone);
      if (c.email) s.add('em:' + c.email);
    });
    return s;
  }, [freshUnread]);

  const isUnread = useCallback((b) => {
    if (!b) return false;
    if (b.bonzo_id && keys.has('id:' + String(b.bonzo_id))) return true;
    const ph = tenDigits(b.phone); if (ph && keys.has('ph:' + ph)) return true;
    const em = lc(b.email); if (em && keys.has('em:' + em)) return true;
    return false;
  }, [keys]);

  const matchConvo = useCallback((b) => {
    if (!b) return null;
    const ph = tenDigits(b.phone), em = lc(b.email), bid = b.bonzo_id != null ? String(b.bonzo_id) : null;
    return items.find(it =>
      (bid && it.prospectId === bid) || (ph && it.phone === ph) || (em && it.email === em)
    ) || null;
  }, [items]);

  const markSeen = useCallback((b) => {
    const c = matchConvo(b);
    if (!c || !c.prospectId) return;
    const ts = c.lastAt || new Date().toISOString();
    setSeen(s => {
      const n = { ...s, [c.prospectId]: ts };
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(n)); } catch (e) { /* ignore */ }
      return n;
    });
  }, [matchConvo]);

  return { isUnread, markSeen };
};
