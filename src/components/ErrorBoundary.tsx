// ============================================================
// Ordinex - Error Boundary
// Catches render errors anywhere below it so a single page
// crash never blanks the demo. Wraps <App /> in main.tsx.
// ============================================================
import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface in dev console; in prod we'd ship this to a logger.
    console.error('Ordinex render error:', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="error-boundary-root">
        <div className="error-boundary-card">
          <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--color-ox-gold)', marginBottom: 12, display: 'block' }}>
            error
          </span>
          <h1>Something went wrong</h1>
          <p>
            The page hit an unexpected error. Your data is safe. Try going back to the home page.
          </p>
          {this.state.error?.message && (
            <pre>{this.state.error.message}</pre>
          )}
          <button type="button" onClick={this.reset} className="landing-submit" style={{ width: 'auto', minWidth: 200, margin: '0 auto', display: 'block' }}>
            Return to home
          </button>
        </div>
      </div>
    );
  }
}
