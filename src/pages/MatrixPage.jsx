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
      // Use Documents bucket (same as other uploads)
      const { error: upErr } = await supabase.storage.from('Documents').upload(path, file);
      if (upErr) {
        alert('Upload failed: ' + upErr.message);
        throw upErr;
      }

      // Get signed URL for viewing
      const { data: signedData } = await supabase.storage.from('Documents').createSignedUrl(path, 60 * 60 * 24 * 365);
      const fileUrl = signedData?.signedUrl || '';

      // Extract lender name from filename
      const lenderName = file.name.replace(/\.(pdf)$/i, '').replace(/[-_]/g, ' ');

      // Save to lender_matrices table
      const { data: insertedData, error: dbErr } = await supabase.from('lender_matrices').upsert({
        user_id: user.id,
        lender_name: lenderName,
        file_path: fileUrl,
        storage_path: path,
        ai_index: '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'lender_name,user_id' }).select().single();

      if (dbErr) {
        alert('Database error: ' + dbErr.message);
        throw dbErr;
      }

      // Parse PDF and index with AI
      try {
        const parseRes = await fetch('/api/parse-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl,
            matrixId: insertedData.id,
            lenderName
          })
        });
        const parseData = await parseRes.json();
        if (!parseData.success) {
          console.warn('PDF indexing warning:', parseData.error);
        }
      } catch (parseErr) {
        console.warn('PDF parse error:', parseErr);
      }

      const { data } = await supabase.from('lender_matrices').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setMatrices(data || []);
    } catch (e) {
      console.error('Matrix upload error:', e);
    } finally {
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
      const res = await fetch('/api/matrix-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context })
      });
      const data = await res.json();
      const reply = data.answer || data.error || 'No response.';
      setChatHistory(h => [...h, { role: 'ai', content: reply }]);
    } catch (e) {
      setChatHistory(h => [...h, { role: 'ai', content: `Error: ${e.message}` }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: Current Matrices - clickable to view PDF */}
      <div style={{ width: '300px', flexShrink: 0, borderRight: '1px solid #333345', padding: '16px', overflow: 'auto' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#e8e8f0', marginBottom: '16px' }}>CURRENT MATRICES</div>

        {matrices.length === 0 ? (
          <div style={{ color: '#6a6a80', fontSize: '12px', padding: '20px', textAlign: 'center' }}>
            No matrices uploaded yet. Drop a PDF on the right to get started.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {matrices.map(m => {
              // Parse lender name - first part is lender, rest is matrix type
              const parts = m.lender_name.split(' ');
              const lender = parts[0] || m.lender_name;
              const matrixType = parts.slice(1).join(' ') || 'Guidelines';
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <a
                    href={m.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1, padding: '8px 10px', background: '#1e293b', borderRadius: '6px',
                      textDecoration: 'none', cursor: 'pointer',
                      border: '1px solid #334155', transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                    onMouseLeave={e => e.currentTarget.style.background = '#1e293b'}
                  >
                    <div style={{ fontWeight: '700', color: '#3b82f6', fontSize: '13px' }}>{lender}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{matrixType}</div>
                  </a>
                  <button type="button" onClick={async () => {
                    await supabase.from('lender_matrices').delete().eq('id', m.id);
                    setMatrices(prev => prev.filter(x => x.id !== m.id));
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Middle: Q&A Chat */}
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

        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
            placeholder={matrices.length === 0 ? 'Upload a PDF first…' : 'Ask a guideline question…'}
            disabled={matrices.length === 0}
            style={{ flex: 1, background: '#1a1a23', border: '1px solid #333345', color: '#e8e8f0', padding: '12px', borderRadius: '6px', fontSize: '13px', outline: 'none', opacity: matrices.length === 0 ? 0.5 : 1, minHeight: '120px', resize: 'none' }}
          />
          <button type="button" className="btn btn-primary" onClick={ask} disabled={asking || matrices.length === 0} style={{ height: '120px', width: '50px' }}>
            {asking ? <Loader size={18} /> : <Send size={18} />}
          </button>
        </div>
      </div>

      {/* Right: Drop Zone */}
      <div style={{ width: '400px', flexShrink: 0, borderLeft: '1px solid #333345', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#e8e8f0', marginBottom: '12px' }}>DROP MATRIX</div>

        <div
          className="matrix-drop"
          style={{ width: '350px', height: '350px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <><Loader size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} /><div style={{ fontSize: '14px' }}>Indexing PDF...</div></>
          ) : (
            <>
              <Upload size={64} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '8px' }}>Drop Lender PDF</div>
              <div style={{ fontSize: '13px', opacity: 0.7 }}>or click to browse</div>
            </>
          )}
        </div>
        <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default MatrixPage;
