import React, { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { useTeamChat } from '../hooks/useTeamChat';
import { useAuth } from '../hooks/useAuth';
import { format, parseISO } from 'date-fns';

const TeamChatBubble = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, sendMessage } = useTeamChat();
  const { profile } = useAuth();
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        <div className="chat-window">
          <div className="chat-header">
            <span>💬 Team Chat</span>
            <button type="button" className="btn-icon" onClick={() => setOpen(false)}><X size={14} /></button>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-msg system">No messages yet. Start the conversation!</div>
            )}
            {messages.map(m => {
              const isMe = m.sender_name === (profile?.full_name || profile?.email);
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: '2px' }}>
                  {!isMe && (
                    <span style={{ fontSize: '10px', color: '#6a6a80', paddingLeft: '4px' }}>
                      {m.sender_name} · {m.sender_role}
                    </span>
                  )}
                  <div className={`chat-msg ${isMe ? 'user' : 'ai'}`}>
                    {m.message}
                  </div>
                  <span style={{ fontSize: '9px', color: '#6a6a80' }}>
                    {m.created_at ? format(parseISO(m.created_at), 'h:mm a') : ''}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <textarea
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Message the team…"
              rows={1}
            />
            <button
              type="button"
              style={{ background: '#065f46', color: 'white', border: 'none', borderRadius: '5px', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              onClick={send}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      <button type="button" className="chat-trigger" style={{ background: '#065f46' }} onClick={() => setOpen(o => !o)} title="Team Chat">
        💬
      </button>
    </div>
  );
};

export default TeamChatBubble;
