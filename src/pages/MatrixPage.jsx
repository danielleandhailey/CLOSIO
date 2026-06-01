import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, X, Send, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { claudeService } from '../lib/claude';
import { useAuth } from '../hooks/useAuth';

const MatrixPage = () => {
  const { user } = useAuth();
  const [matrices, setMatrices] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const dropRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    if (!user) return;
    supabase.from('lender_matrices').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setMatrices(data || []));
  }, [user]);

  const handleFile = async (file) => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('matrices').upload(path, file);
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('matrices').getPublicUrl(path);

      // AI index the PDF
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(',')[1];
        let aiIndex = '';
        try {
          const result = await claudeService.analyzeDocument(base64, 'application/pdf', file.name);
          aiIndex = JSON.stringify({ summary: result.summary, extracted: result.extracted });
        } catch (e) {
          aiIndex = 'Index unavailable';
        }

        const lenderName = file.name.replace(/\.(pdf)$/i, '').replace(/[-_]/g, ' ');

        await supabase.from('lender_matrices').upsert({
          user_id: user.id,
          lender_name: lenderName,
          file_path: urlData.publicUrl,
          ai_index: aiIndex,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'lender_name,user_id' });

        const { data } = await supabase.from('lender_matrices').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        setMatrices(data || []);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error('Matrix upload error:', e);
      setUploading(false);
    }
  };

  const ask = async () => {
    if (!question.trim() || asking) return;
    const q = question.trim();
    setQuestion('');
    setAsking(true);

    const context = matrices.map(m => `Lender: ${m.lender_name}\n${m.ai_index}`).join('\n\n---\n\n');
    setChatHistory(h => [...h, { role: 'user', content: q }]);

    try {
      const reply = await claudeService.matrixQuery(q, context);
      setChatHistory(h => [...h, { role: 'ai', content: reply }]);
    } catch (e) {
      setChatHistory(h => [...h, { role: 'ai', content: `Error: ${e.message}` }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: Upload */}
      <div style={{ width: '280px', flexShrink: 0, borderRight: '1px solid #333345', padding: '16px', overflow: 'auto' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#e8e8f0', marginBottom: '12px' }}>🗂 Lender Matrices</div>

        <div
          className="matrix-drop"
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <><Loader size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '6px' }} /><div>Indexing PDF…</div></>
          ) : (
            <>
              <Upload size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <div style={{ fontWeight: '500', marginBottom: '4px' }}>Drop Lender PDF</div>
              <div style={{ fontSize: '11px', opacity: 0.7 }}>AI reads and indexes privately per your account</div>
            </>
          )}
        </div>
        <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />

        {matrices.length > 0 && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#6a6a80', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Indexed Lenders</div>
            {matrices.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#22222e', borderRadius: '5px', marginBottom: '4px', fontSize: '12px' }}>
                <FileText size={14} style={{ color: '#9f67f7', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', color: '#e8e8f0' }}>{m.lender_name}</div>
                  <div style={{ fontSize: '10px', color: '#6a6a80' }}>Updated {new Date(m.updated_at).toLocaleDateString()}</div>
                </div>
                <button type="button" onClick={async () => {
                  await supabase.from('lender_matrices').delete().eq('id', m.id);
                  setMatrices(prev => prev.filter(x => x.id !== m.id));
                }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6a6a80' }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Q&A Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', overflow: 'hidden' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#e8e8f0', marginBottom: '12px' }}>
          🔍 Plain-English Q&A
          <span style={{ fontSize: '11px', fontWeight: '400', color: '#6a6a80', marginLeft: '8px' }}>
            Ask anything about your indexed lender guidelines
          </span>
        </div>

        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
          {chatHistory.length === 0 && (
            <div style={{ color: '#6a6a80', fontSize: '12px', textAlign: 'center', padding: '40px' }}>
              {matrices.length === 0
                ? 'Upload a lender guideline PDF to get started. AI will index it and you can ask questions in plain English.'
                : 'Ask anything about your lender guidelines. E.g., "What is the max DTI for FHA with a 580 score?" or "Does PRMG allow gift funds on investment properties?"'}
            </div>
          )}
          {chatHistory.map((m, i) => (
            <div key={i} style={{
              padding: '10px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              lineHeight: 1.6,
              maxWidth: m.role === 'user' ? '70%' : '100%',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? '#7c3aed' : '#22222e',
              color: m.role === 'user' ? 'white' : '#e8e8f0',
            }}>
              {m.content}
            </div>
          ))}
          {asking && (
            <div style={{ padding: '10px 12px', borderRadius: '6px', fontSize: '12px', background: '#22222e', color: '#a0a0b8', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Looking through your matrices…
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask()}
            placeholder={matrices.length === 0 ? 'Upload a PDF first…' : 'Ask a guideline question…'}
            disabled={matrices.length === 0}
            style={{ flex: 1, background: '#1a1a23', border: '1px solid #333345', color: '#e8e8f0', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', outline: 'none', opacity: matrices.length === 0 ? 0.5 : 1 }}
          />
          <button type="button" className="btn btn-primary" onClick={ask} disabled={asking || matrices.length === 0}>
            {asking ? <Loader size={14} /> : <Send size={14} />}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default MatrixPage;
