import React, { useState } from 'react';

const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();
};

// Bonzo conversation view — used both in the borrower card tab and the row CONVO popup.
const CommunicationPanel = ({ borrower }) => {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [linkedId, setLinkedId] = useState(borrower.bonzo_id || null);
  const [linking, setLinking] = useState(false);

  const fetchBonzoComms = async (id = linkedId) => {
    if (!id) { setError('No Bonzo ID linked'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bonzo-comms?prospectId=${id}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        const sorted = (data.messages || []).slice().sort(
          (a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0)
        );
        setMessages(sorted);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const linkBonzo = async () => {
    setLinking(true);
    setError(null);
    try {
      const params = new URLSearchParams({ borrowerId: borrower.id, phone: borrower.phone || '', email: borrower.email || '', name: borrower.name || '' });
      const res = await fetch(`/api/bonzo-link?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.prospectId) {
        setLinkedId(data.prospectId);
        fetchBonzoComms(data.prospectId);
      } else {
        setError(data.error || 'Could not find this borrower in Bonzo.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLinking(false);
    }
  };

  React.useEffect(() => {
    if (linkedId) fetchBonzoComms(linkedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedId]);

  return (
    <div style={{ fontSize: '12px', color: '#334155' }}>
      {linkedId ? (
        <>
          <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => fetchBonzoComms()} disabled={loading}
              style={{ padding: '6px 12px', background: '#ec4899', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <a href={`https://platform.getbonzo.com/conversations/${linkedId}`} target="_blank" rel="noopener noreferrer"
              style={{ color: '#ec4899', fontSize: '11px', fontWeight: '600' }}>
              Open in Bonzo
            </a>
          </div>
          {error && <div style={{ color: '#ef4444', marginBottom: '8px' }}>{error}</div>}
          {messages.length > 0 ? (
            <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {messages.map((m, i) => (
                <div key={i} style={{ padding: '12px', background: m.direction === 'outbound' ? '#dbeafe' : '#f8fafc', borderRadius: '8px', borderLeft: `4px solid ${m.direction === 'outbound' ? '#3b82f6' : '#64748b'}` }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: '600' }}>
                    {m.direction === 'outbound' ? '→ Sent' : '← Received'} • {m.date}
                  </div>
                  <div style={{ fontSize: '15px', color: '#1e293b', lineHeight: 1.6 }}>{stripHtml(m.body)}</div>
                </div>
              ))}
            </div>
          ) : !loading && (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No messages yet.</div>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ color: '#94a3b8', marginBottom: '12px' }}>Not linked to Bonzo yet.</div>
          <button type="button" onClick={linkBonzo} disabled={linking}
            style={{ padding: '8px 16px', background: linking ? '#9ca3af' : '#ec4899', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: linking ? 'default' : 'pointer' }}>
            {linking ? 'Searching Bonzo…' : '🔗 Find in Bonzo'}
          </button>
          {error && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '10px' }}>{error}</div>}
        </div>
      )}
    </div>
  );
};

export default CommunicationPanel;
