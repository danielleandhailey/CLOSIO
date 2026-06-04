import React, { useState, useEffect } from 'react';
import { Zap, Loader } from 'lucide-react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useBorrowers } from './hooks/useBorrowers';
import { bonzoService } from './lib/bonzo';
import { format } from 'date-fns';
import LoginPage from './pages/LoginPage';
import PipelinePage from './pages/PipelinePage';
import CalendarPage from './pages/CalendarPage';
import RateTreadPage from './pages/RateTreadPage';
import MatrixPage from './pages/MatrixPage';
import AIChatBubble from './components/AIChatBubble';
import TeamChatBubble from './components/TeamChatBubble';
import './styles/global.css';

// Theme toggle — stores per user in localStorage, persists across refreshes
const useTheme = (userId) => {
  const key = userId ? `closio_theme_${userId}` : 'closio_theme_default';

  const [dark, setDark] = useState(() => {
    // Always read from localStorage on init
    const saved = localStorage.getItem(key);
    if (saved) return saved === 'dark';
    // Also check the generic key as fallback
    const generic = localStorage.getItem('closio_theme_default');
    if (generic) return generic === 'dark';
    return true; // default dark
  });

  // Apply theme to both html and body
  useEffect(() => {
    localStorage.setItem(key, dark ? 'dark' : 'light');
    localStorage.setItem('closio_theme_default', dark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.body.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark, key]);

  return [dark, setDark];
};

const TABS = ['Pipeline', 'Calendar', 'Rate Retread', 'Matrix'];

const AppInner = () => {
  const { user, profile, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('Pipeline');
  const [dark, setDark] = useTheme(user?.id);

  const borrowerHook = useBorrowers();
  const { borrowers, loading: loadingBorrowers, seedInitialData, ...ops } = borrowerHook;

  // Seed initial data on first load
  useEffect(() => {
    if (user && !loadingBorrowers) {
      seedInitialData().catch(console.error);
    }
  }, [user, loadingBorrowers, seedInitialData]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f13', color: '#9f67f7', fontFamily: 'Space Mono, monospace', fontSize: '14px' }}>
        CLOSIO™ loading…
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <div className="app-shell">
      {/* Top Nav */}
      <nav className="top-nav">
        <div className="brand">
          <strong style={{ color: '#fff', fontWeight: '800', letterSpacing: '0.02em' }}>CLOSIO™</strong>
          <span>Close More. Pipeline Manager.</span>
        </div>

        <div className="nav-tabs">
          {TABS.map(tab => (
            <button
              key={tab}
              type="button"
              className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'Pipeline' && '📋 '}
              {tab === 'Calendar' && '📅 '}
              {tab === 'Rate Retread' && '📉 '}
              {tab === 'Matrix' && '🗂 '}
              {tab}
            </button>
          ))}

          {/* Bonzo Buttons */}
          <button type="button" className="btn btn-ghost" style={{ marginLeft: '12px' }} title="Sync leads from Bonzo CRM"
            onClick={async () => {
              try {
                const res = await fetch('/api/bonzo-pull');
                const data = await res.json();
                if (data.success) {
                  alert(`Bonzo Pull: ${data.created} created, ${data.updated} updated`);
                  window.location.reload();
                } else {
                  alert('Bonzo Pull failed: ' + (data.error || 'Unknown error'));
                }
              } catch (e) {
                alert('Bonzo Pull error: ' + e.message);
              }
            }}>
            <Zap size={12} /> Bonzo Pull
          </button>
          <button type="button" className="btn btn-ghost" title="Push updates to Bonzo CRM">
            <Zap size={12} /> Bonzo Push
          </button>
          <button type="button" className="btn btn-ghost" title="Send Email">
            Email
          </button>
          <button type="button" className="btn btn-ghost" title="Send Text">
            Text
          </button>
        </div>

        <div className="nav-right">
          <div style={{ fontSize: '11px', color: '#6a6a80', textAlign: 'right' }}>
            <div style={{ color: '#a0a0b8', fontWeight: '500' }}>{profile?.full_name || user.email}</div>
            <div style={{ color: '#6a6a80' }}>{profile?.role || 'LOA'}</div>
          </div>
          {/* Discrete day/night toggle */}
          <button
            type="button"
            onClick={() => setDark(d => !d)}
            title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              width: '36px', height: '20px', borderRadius: '10px', border: 'none',
              background: dark ? '#3a3a55' : '#c4b5fd',
              cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: '3px',
              left: dark ? '18px' : '3px',
              width: '14px', height: '14px', borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px',
            }}>
              {dark ? '🌙' : '☀️'}
            </span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={signOut}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loadingBorrowers ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#6a6a80', fontSize: '13px' }}>
            Loading pipeline…
          </div>
        ) : (
          <>
            {activeTab === 'Pipeline' && (
              <PipelinePage borrowers={borrowers} ops={{ ...ops, refetch: borrowerHook.refetch }} />
            )}
            {activeTab === 'Calendar' && (
              <CalendarPage borrowers={borrowers} />
            )}
            {activeTab === 'Rate Retread' && (
              <RateTreadPage borrowers={borrowers} />
            )}
            {activeTab === 'Matrix' && (
              <MatrixPage />
            )}
          </>
        )}
      </div>

      {/* Floating chat bubbles */}
      {user && (
        <>
          <AIChatBubble borrowers={borrowers} onNavigate={setActiveTab} />
          <TeamChatBubble />
        </>
      )}
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <AppInner />
  </AuthProvider>
);

export default App;
