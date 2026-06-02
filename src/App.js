import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useBorrowers } from './hooks/useBorrowers';
import LoginPage from './pages/LoginPage';
import PipelinePage from './pages/PipelinePage';
import CalendarPage from './pages/CalendarPage';
import RateTreadPage from './pages/RateTreadPage';
import MatrixPage from './pages/MatrixPage';
import AIChatBubble from './components/AIChatBubble';
import TeamChatBubble from './components/TeamChatBubble';
import './styles/global.css';

const TABS = ['Pipeline', 'Calendar', 'Rate Retread', 'Matrix'];

const AppInner = () => {
  const { user, profile, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('Pipeline');

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
          CLOSIO™
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
        </div>

        <div className="nav-right">
          <div style={{ fontSize: '11px', color: '#6a6a80', textAlign: 'right' }}>
            <div style={{ color: '#a0a0b8', fontWeight: '500' }}>{profile?.full_name || user.email}</div>
            <div style={{ color: '#6a6a80' }}>{profile?.role || 'LOA'}</div>
          </div>
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
