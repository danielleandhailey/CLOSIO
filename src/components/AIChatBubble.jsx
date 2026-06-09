import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader } from 'lucide-react';
import { claudeService } from '../lib/claude';
import { formatCurrency, formatDate, formatRate } from '../lib/utils';
import { supabase } from '../lib/supabase';

const buildPipelineContext = (borrowers) => {
  if (!borrowers || borrowers.length === 0) return 'No borrowers in pipeline.';
  return borrowers.map(b => {
    const tags = (b.borrower_tags || []).map(t => t.tag).join(', ');
    const tasks = (b.tasks || []).filter(t => !t.completed).length;
    const contingencies = (b.contingencies || []).filter(c => !c.completed).length;
    const stips = (b.stipulations || []).filter(s => !s.received).length;
    return `- ${b.name} | Stage: ${b.stage} | Lender: ${b.lender || '—'} | Rate: ${formatRate(b.rate)} (${b.rate_status || 'Floating'}) | COE: ${formatDate(b.coe_date)} | Loan: ${formatCurrency(b.loan_amount)} | Tags: ${tags || 'none'} | Open Tasks: ${tasks} | Contingencies: ${contingencies} | Stips Needed: ${stips}`;
  }).join('\n');
};

const AIChatBubble = ({ borrowers, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: "Hi - what's up?",
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [matrixContext, setMatrixContext] = useState('');
  const bottomRef = useRef();
  const inputRef = useRef();

  // Load matrix data on mount
  useEffect(() => {
    const loadMatrix = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('lender_matrices').select('lender_name, ai_index').eq('user_id', user.id);
      if (data && data.length > 0) {
        const ctx = data.map(m => `=== ${m.lender_name} ===\n${m.ai_index || ''}`).join('\n\n');
        setMatrixContext(ctx);
      }
    };
    loadMatrix();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const pipelineCtx = buildPipelineContext(borrowers);
      const fullContext = `PIPELINE:\n${pipelineCtx}\n\nLENDER GUIDELINES:\n${matrixContext || 'No lender matrices uploaded yet.'}`;
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const reply = await claudeService.chat(history, fullContext);

      // Check for navigation commands
      if (reply.includes('NAVIGATE:')) {
        const tab = reply.split('NAVIGATE:')[1].split('\n')[0].trim();
        onNavigate?.(tab);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Opening ${tab} tab for you…`,
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${e.message}. Check your Claude API key configuration.`,
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="chat-bubble" style={{ right: '80px' }}>
      {open && (
        <div className="chat-window" style={{ width: '500px', height: '600px', fontSize: '18px' }}>
          <div className="chat-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ background: '#d97706', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', fontSize: '11px' }}>C</span> Claude AI</span>
            <button type="button" className="btn-icon" onClick={() => setOpen(false)}><X size={14} /></button>
          </div>

          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role === 'user' ? 'user' : 'ai'}`} style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="chat-msg ai">
                <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask about your pipeline…"
              rows={1}
            />
            <button type="button" className="btn-icon btn-primary" style={{ background: '#7c3aed', color: 'white', borderRadius: '5px', width: '36px', height: '36px', flexShrink: 0 }} onClick={send} disabled={loading}>
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      <button type="button" className="chat-trigger" onClick={() => setOpen(o => !o)} title="Ask Claude AI" style={{ background: '#d97706', fontSize: '16px', fontWeight: '700' }}>
        ?
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AIChatBubble;
