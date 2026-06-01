import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const LoginPage = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login'); // login | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('LOA');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) throw error;
      } else {
        const { error } = await signUp(email, password, fullName, role);
        if (error) throw error;
        setSuccess('Account created! Check your email to confirm, then sign in.');
        setMode('login');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f13',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: '#1a1a23',
        border: '1px solid #333345',
        borderRadius: '10px',
        padding: '32px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: '22px',
            fontWeight: '700',
            color: '#9f67f7',
            letterSpacing: '0.05em',
            marginBottom: '4px',
          }}>CLOSIO™</div>
          <div style={{ fontSize: '11px', color: '#6a6a80', letterSpacing: '0.08em' }}>
            MORTGAGE PIPELINE INTELLIGENCE
          </div>
        </div>

        {success && (
          <div style={{
            background: '#dcfce7', color: '#14532d', padding: '10px 14px',
            borderRadius: '6px', marginBottom: '16px', fontSize: '13px',
          }}>{success}</div>
        )}

        {error && (
          <div style={{
            background: '#fee2e2', color: '#991b1b', padding: '10px 14px',
            borderRadius: '6px', marginBottom: '16px', fontSize: '13px',
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6a6a80', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>Full Name</label>
                <input
                  className="form-input"
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6a6a80', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>Role</label>
                <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="LO">Loan Officer (LO)</option>
                  <option value="LOA">Loan Officer Assistant (LOA)</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6a6a80', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6a6a80', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              background: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginBottom: '14px',
            }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '12px', color: '#6a6a80' }}>
          {mode === 'login' ? (
            <>Don't have an account?{' '}
              <button onClick={() => setMode('signup')} style={{ color: '#9f67f7', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>
                Sign up
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => setMode('login')} style={{ color: '#9f67f7', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
