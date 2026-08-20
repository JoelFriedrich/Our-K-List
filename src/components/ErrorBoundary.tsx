import React from 'react';
import { RefreshCw } from 'lucide-react';
import { getErrorMessage, logError } from '../lib/errors';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };
  private readonly children: React.ReactNode;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.children = props.children;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logError('React render error', { error, errorInfo });
  }

  render() {
    if (!this.state.error) return this.children;

    return (
      <div className="min-h-screen bg-dark-bg text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-5">
          <h1 className="serif-title text-3xl text-netflix-red">Something went wrong</h1>
          <p className="text-zinc-400">{getErrorMessage(this.state.error)}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary inline-flex items-center gap-2 px-5 py-3"
          >
            <RefreshCw size={16} />
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
