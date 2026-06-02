import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('CLOSIO Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#13131a', color: '#f0f0ff', fontFamily: 'DM Sans, sans-serif',
          gap: '16px', padding: '20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '40px' }}>⚠️</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#b07eff' }}>CLOSIO™ hit a snag</div>
          <div style={{ fontSize: '13px', color: '#8080a8', maxWidth: '400px', lineHeight: 1.6 }}>
            Something went wrong. Your data is safe — just reload the page.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 28px', background: '#8b4cf7', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '14px',
              fontWeight: '700', cursor: 'pointer', marginTop: '8px',
            }}
          >
            🔄 Reload CLOSIO
          </button>
          <div style={{ fontSize: '10px', color: '#50507a', marginTop: '8px' }}>
            {this.state.error?.message}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
