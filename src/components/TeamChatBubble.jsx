import React, { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { useTeamChat } from '../hooks/useTeamChat';
import { useAuth } from '../hooks/useAuth';
import { format, parseISO } from 'date-fns';

const TeamChatBubble = () => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [flash, setFlash] = useState(false);
  const { messages, sendMessage } = useTeamChat();
  const { profile } = useAuth();
  const bottomRef = useRef();
  const prevCount = useRef(messages.length);

  const myName = profile?.full_name || profile?.email || '';

  // Flash yellow when new message from teammate
  useEffect(() => {
    if (messages.length > prevCount.current) {
      const newMsg = messages[messages.length - 1];
      if (newMsg?.sender_name !== myName) {
        setFlash(true);
        setTimeout(() => setFlash(false), 3000);
      }
    }
    prevCount.current = messages.length;
  }, [messages, myName]);

  // Scroll to bottom when chat opens or new message
  useEffect(() => {
    if (open && !minimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, open, minimized]);

  const send = async () => {
    const text = input.trim();
    if (!text || !profile) return;
    setInput('');
    try {
      await sendMessage(text, profile.full_name || profile.email, profile.role);
    } catch (e) {
      console.error('Send chat error:', e);
    }
  };

  return (
    <div className="chat-bubble" style={{ right: '20px' }}>
      {open && (
        <div className="chat-window" style={{ height: minimized ? 'auto' : '380px' }}>
          <div className="chat-header" style={{ background: '#0d9488', cursor: 'pointer' }} onClick={() => setMinimized(m => !m)}>
            <span>💬 Team Chat</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button type="button" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px', padding: '2px 6px' }}
                onClick={e => { e.stopPropagation(); setMinimized(m => !m); }}>
                {minimized ? '□' : '−'}
              </button>
              <button type="button" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}
                onClick={e => { e.stopPropagation(); setOpen(false); }}>
                ✕
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              <div className="chat-messages" style={{ background: '#e0f2fe' }}>
                {messages.length === 0 && (
                  <div style={{ color: '#0369a1', textAlign: 'center', padding: '20px', fontSize: '12px' }}>
                    No messages yet. Start the conversation!
                  </div>
                )}
                {messages.map(m => {
                  const isMe = m.sender_name === (profile?.full_name || profile?.email);
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: '2px' }}>
                      {!isMe && (
                        <span style={{ fontSize: '10px', color: '#0369a1', paddingLeft: '4px' }}>
                          {m.sender_name} · {m.sender_role}
                        </span>
                      )}
                      <div style={{
                        padding: '8px 12px', borderRadius: '12px', maxWidth: '85%', fontSize: '13px',
                        background: isMe ? '#0d9488' : '#ffffff',
                        color: isMe ? '#fff' : '#1e293b',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      }}>
                        {m.message}
                      </div>
                      <span style={{ fontSize: '9px', color: '#64748b' }}>
                        {m.created_at ? format(parseISO(m.created_at), 'h:mm a') : ''}
                      </span>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="chat-input-row" style={{ background: '#f0f9ff', borderTop: '1px solid #bae6fd' }}>
                <textarea
                  className="chat-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Message the team…"
                  rows={1}
                  style={{ background: '#fff', color: '#1e293b', border: '1px solid #bae6fd' }}
                />
                <button
                  type="button"
                  style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: '5px', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  onClick={send}
                >
                  <Send size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button type="button" className="chat-trigger" style={{ background: flash ? '#f59e0b' : '#065f46', position: 'relative', animation: flash ? 'pulse 1s infinite' : 'none', border: flash ? '3px solid #fbbf24' : 'none' }} onClick={() => setOpen(o => !o)} title="Team Chat">
        💬
        {flash && <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff', fontWeight: '700' }}>!</span>}
      </button>
    </div>
  );
};

export default TeamChatBubble;
