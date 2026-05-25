import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    if (window.electronAPI?.logError) {
      window.electronAPI.logError({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleReload() {
    window.location.reload();
  }

  handleReset() {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#000',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '40px',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '24px', fontWeight: '400', marginBottom: '16px', color: '#888' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '32px', maxWidth: '480px', lineHeight: '1.6' }}>
            The application encountered an unexpected error. You can try reloading or resetting to recover.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                border: '1px solid #444',
                background: '#111',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Reload App
            </button>
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                border: '1px solid #333',
                background: 'transparent',
                color: '#888',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Try to Recover
            </button>
          </div>
          {this.state.error && (
            <details style={{ marginTop: '40px', maxWidth: '640px', textAlign: 'left' }}>
              <summary style={{ color: '#555', cursor: 'pointer', fontSize: '13px', marginBottom: '12px' }}>
                Error Details
              </summary>
              <pre style={{
                fontSize: '12px',
                color: '#888',
                backgroundColor: '#111',
                padding: '16px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '300px',
              }}>
                {this.state.error.stack || this.state.error.message}
                {this.state.errorInfo?.componentStack && '\n\nComponent Stack:' + this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
