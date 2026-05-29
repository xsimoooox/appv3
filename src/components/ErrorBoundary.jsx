import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
    });
    console.error('[ERROR_BOUNDARY]', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#f3f4f6',
          padding: '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <h1 style={{ color: '#dc2626', marginBottom: '20px' }}>Erreur Application</h1>
          <p style={{ color: '#374151', marginBottom: '20px', maxWidth: '600px' }}>
            {this.state.error?.toString()}
          </p>
          {this.state.errorInfo && (
            <details style={{ 
              whiteSpace: 'pre-wrap', 
              background: '#fff', 
              padding: '20px', 
              borderRadius: '8px',
              maxWidth: '600px',
              fontSize: '12px',
              color: '#4b5563',
              border: '1px solid #e5e7eb',
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>
                Détails techniques
              </summary>
              {this.state.errorInfo.componentStack}
            </details>
          )}
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Recharger la page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
