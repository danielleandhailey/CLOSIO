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

// Bonzo Pull button with loading state
const BonzoPullButton = () => {
  const [pulling, setPulling] = useState(false);

  const handlePull = async () => {
    setPulling(true);
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
    setPulling(false);
  };

  return (
    <button
      type="button"
      className="btn btn-ghost"
      style={{
        marginLeft: '12px',
        background: pulling ? '#fbbf24' : undefined,
        color: pulling ? '#000' : undefined,
        borderColor: pulling ? '#fbbf24' : undefined,
      }}
      title="Sync leads from Bonzo CRM"
      onClick={handlePull}
      disabled={pulling}
    >
      <Zap size={12} style={{ color: pulling ? '#000' : undefined }} /> {pulling ? 'Pulling...' : 'Bonzo Pull'}
    </button>
  );
};

const LENDERS = [
  { name: 'Rocket Pro', url: 'https://app.rocketpro.com/' },
  { name: 'Figure', url: 'https://www.figure.com/leadportal/app/dashboard' },
  { name: 'Spring EQ', url: 'https://broker.springeq.com/portal/#/home' },
  { name: 'PRMG', url: 'https://leo.prmg.net/tpo/dashboard' },
  { name: 'Flyhomes', url: 'https://flyhomes.com/buy-before-you-sell-get-started' },
  { name: 'SmartFi', url: 'https://app.smartfihomeloans.com/home' },
  { name: 'NPI Non-QM', url: 'https://www.npinonqm.com/#/home' },
  { name: 'LoanStream', url: 'https://www.lsmlounge.com/tpo/' },
  { name: 'Spring EQ EMMA', url: 'https://emma.springeq.com/home' },
  { name: 'Champions TPO', url: 'https://www.champstpo.com/#QuickPricer' },
  { name: 'Deephaven HELOC', url: 'https://heloc.deephavenmortgage.com/portal/login' },
  { name: 'EPM', url: 'https://epmexperience.com/pipeline' },
  { name: 'TLS (Loan Store)', url: 'https://theloanstore.encompasstpoconnect.com/#/home' },
  { name: 'Button Finance', url: 'https://buttonfinance.encompasstpoconnect.com/#/content/home_395998' },
  { name: 'NewRez', url: 'https://auth.newrez.com/signin' },
  { name: 'MAM', url: 'https://mam.mmachine.net/Login.aspx' },
  { name: 'Quantum Reverse', url: 'https://app.quantumreverse.com/dashboard' },
  { name: 'Kind Lending', url: 'https://kwikie.kindlending.com/login' },
  { name: 'Deephaven', url: 'https://deephavenmortgage.lodasoft.com/tpo/dashboard' },
  { name: 'PennyMac', url: 'https://power.pennymac.com/#/home' },
  { name: 'NFTY', url: 'https://lo.homeequity.westcapitallending.com/all-loans?view=active' },
];

const LendersDropdown = () => {
  const [search, setSearch] = useState('');
  const filtered = search
    ? LENDERS.filter(l => l.name.toLowerCase().includes(search.toLowerCase()))
    : LENDERS;

  return (
    <div style={{ position: 'relative' }} className="nav-dropdown">
      <button type="button" className="btn btn-ghost">Lenders ▾</button>
      <div className="dropdown-menu" style={{ maxHeight: '400px', overflowY: 'auto', minWidth: '200px' }}>
        <button onClick={() => window.open('https://portal.westcaplending.com/wclcorelenders', '_blank')} style={{ fontWeight: '600', color: '#3b82f6' }}>Lender Search (WCL)</button>
        <div style={{ padding: '4px 8px' }}>
          <input
            type="text"
            placeholder="Type to filter..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #444', background: '#1a1a23', color: '#fff', fontSize: '11px' }}
          />
        </div>
        <div style={{ borderTop: '1px solid #333', margin: '4px 0' }}></div>
        {filtered.map(l => (
          <button key={l.name} onClick={() => window.open(l.url, '_blank')}>{l.name}</button>
        ))}
        {filtered.length === 0 && <div style={{ padding: '8px 14px', color: '#6a6a80', fontSize: '11px' }}>No matches</div>}
      </div>
    </div>
  );
};

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

  // Listen for Matrix open event from Pipeline
  useEffect(() => {
    const handler = () => setActiveTab('Matrix');
    window.addEventListener('openMatrix', handler);
    return () => window.removeEventListener('openMatrix', handler);
  }, []);

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
          <span style={{ color: '#64748b', fontSize: '11px' }}>Close More. Stress Less.</span>
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
              {tab === 'Matrix' ? 'Matrix+' : tab}
            </button>
          ))}

          {/* LP Pull */}
          <button
            type="button"
            className="btn btn-ghost"
            title="Pull loans from LendingPad"
            onClick={async (e) => {
              const btn = e.currentTarget;
              btn.disabled = true;
              btn.innerHTML = '<span>Pulling...</span>';
              try {
                const res = await fetch('/api/lendingpad-pull');
                const data = await res.json();
                if (data.success) {
                  alert(`LP Pull: ${data.created} created, ${data.updated} updated`);
                  window.location.reload();
                } else {
                  alert('LP Pull: ' + (data.error || 'Failed'));
                }
              } catch (err) {
                alert('LP Pull error: ' + err.message);
              }
              btn.disabled = false;
              btn.innerHTML = '<svg width="12" height="12"><use href="#zap"/></svg> LP Pull';
            }}
          >
            <Zap size={12} /> LP Pull
          </button>

          {/* Bonzo Buttons */}
          <BonzoPullButton />
          <button type="button" className="btn btn-ghost" title="Push updates to Bonzo CRM">
            <Zap size={12} /> Bonzo Push
          </button>

          {/* BrokerFlow */}
          <button type="button" className="btn btn-ghost" title="Pull from BrokerFlow">
            <Zap size={12} /> BrokerFlow Pull
          </button>
          <button type="button" className="btn btn-ghost" title="Push to BrokerFlow">
            <Zap size={12} /> BrokerFlow Push
          </button>

          {/* External Links */}
          <button type="button" className="btn btn-ghost" onClick={() => window.open('https://prod.lendingpad.com/web/#/dashboard', '_blank')}>
            Lending Pad
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => window.open('https://manage.lenderhomepage.com/', '_blank')}>
            Loanzify
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => window.open('https://loansifter.com', '_blank')}>
            LoanSifter
          </button>
          {/* Calculators Dropdown */}
          <div style={{ position: 'relative' }} className="nav-dropdown">
            <button type="button" className="btn btn-ghost">
              Calculators ▾
            </button>
            <div className="dropdown-menu">
              <div style={{ borderBottom: '1px solid #333', margin: '4px 0', padding: '4px 8px', fontSize: '10px', color: '#6a6a80', fontWeight: '600' }}>BUILT-IN</div>
              <button onClick={() => window.open('https://www.bankrate.com/calculators/mortgages/debt-consolidation-calculator.aspx', '_blank')}>Debt Consolidation</button>
              <button onClick={() => window.open('https://www.calculator.net/self-employment-tax-calculator.html', '_blank')}>Self-Employed Income</button>
              <button onClick={() => window.open('https://www.mortgagecalculator.org/calculators/what-if-i-pay-more-calculator.php', '_blank')}>Extra Payment</button>
              <button onClick={() => window.open('https://wholesale.springeq.com/blendedratecalc', '_blank')}>Blended Rate</button>
              <button onClick={() => window.open('https://www.veteransunited.com/va-loans/calculator/', '_blank')}>VA Funding Fee</button>
              <button onClick={() => window.open('https://www.fha.com/fha_streamline_refinance', '_blank')}>FHA Streamline Seasoning</button>
              <div style={{ borderBottom: '1px solid #333', margin: '4px 0', padding: '4px 8px', fontSize: '10px', color: '#6a6a80', fontWeight: '600' }}>EXTERNAL</div>
              <button onClick={() => window.open('https://www.mortgagecalculator.org', '_blank')}>Mortgage Calculator</button>
              <button onClick={() => window.open('https://nexarate.netlify.app/nexarate.netlify.app/page.genspark.site/page/toolu_01yzgm8vgfwqfwbevjzza7c8/modern_loan_calculator_final_pdf.html', '_blank')}>Net Effective</button>
              <button onClick={() => window.open('https://app.quantumreverse.com/fcc03f2f-2545-488d-a22a-45b3ea0ee6b2?type=htmlForm', '_blank')}>Quantum Reverse Calc</button>
              <button onClick={() => window.open('https://bretwhissel.net/amortization/', '_blank')}>Amortization</button>
              <button onClick={() => window.open('https://app.quantumreverse.com/fcc03f2f-2545-488d-a22a-45b3ea0ee6b2?type=htmlForm&age=67&state=CA&propertyValue=494000&liens=90000&NotPaidOffLiens=183000', '_blank')}>Quantum Reverse (Pre-filled)</button>
            </div>
          </div>

          {/* WCL Dropdown */}
          <div style={{ position: 'relative' }} className="nav-dropdown">
            <button type="button" className="btn btn-ghost">
              WCL ▾
            </button>
            <div className="dropdown-menu">
              <button onClick={() => window.open('https://portal.westcaplending.com/lead_store/lead_flow', '_blank')}>Lead Store</button>
              <button onClick={() => window.open('https://portal.westcaplending.com/payrolls', '_blank')}>Payroll</button>
              <button onClick={() => window.open('https://portal.wcl.com', '_blank')}>Portal</button>
              <button onClick={() => window.open('https://ticket.wcl.com', '_blank')}>Ticket</button>
              <button onClick={() => window.open('https://docguardian.wcl.com', '_blank')}>Doc Guardian</button>
              <div style={{ borderTop: '1px solid #333', margin: '4px 0', padding: '4px 8px', fontSize: '10px', color: '#6a6a80', fontWeight: '600' }}>VENDORS</div>
              {/* Vendors - to be added */}
              <div style={{ borderTop: '1px solid #333', margin: '4px 0', padding: '4px 8px', fontSize: '10px', color: '#6a6a80', fontWeight: '600' }}>RESOURCES</div>
              {/* Resources - to be added */}
            </div>
          </div>

          {/* Lenders Dropdown */}
          <LendersDropdown />

          {/* Resources Dropdown */}
          <div style={{ position: 'relative' }} className="nav-dropdown">
            <button type="button" className="btn btn-ghost">
              Resources ▾
            </button>
            <div className="dropdown-menu">
              <button onClick={() => window.open('https://www.nmlsconsumeraccess.org/', '_blank')}>NMLS</button>
              <button onClick={() => window.open('https://oncoursehome.com/', '_blank')}>OnCourse</button>
              <button onClick={() => window.open('https://leadmailbox.com/', '_blank')}>Lead Mailbox</button>
            </div>
          </div>
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
