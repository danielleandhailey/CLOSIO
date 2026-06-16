import { useState, useEffect, useCallback, useMemo } from 'react';

// Polls Bonzo (via /api/bonzo-unread) every 15s for conversations with unread
// (new inbound) texts and exposes isUnread(borrower). The unread state mirrors
// Bonzo's own unread_messages_count — it clears automatically when Bonzo marks
// the conversation read (so opening CONVO in CLOSIO never drops a file out from
// under a filter). A borrower matches a conversation by bonzo_id, phone, or email.
const tenDigits = (s) => (s || '').replace(/\D/g, '').slice(-10);
const lc = (s) => (s || '').toLowerCase().trim();

export const useUnreadTexts = (intervalMs = 15000) => {
  const [items, setItems] = useState([]);

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

  // Lookup keys (id / phone / email) for every conversation Bonzo flags unread.
  const keys = useMemo(() => {
    const s = new Set();
    items.filter(it => it.unread).forEach(c => {
      if (c.prospectId) s.add('id:' + c.prospectId);
      if (c.phone) s.add('ph:' + c.phone);
      if (c.email) s.add('em:' + c.email);
    });
    return s;
  }, [items]);

  const isUnread = useCallback((b) => {
    if (!b) return false;
    if (b.bonzo_id && keys.has('id:' + String(b.bonzo_id))) return true;
    const ph = tenDigits(b.phone); if (ph && keys.has('ph:' + ph)) return true;
    const em = lc(b.email); if (em && keys.has('em:' + em)) return true;
    return false;
  }, [keys]);

  return { isUnread };
};
