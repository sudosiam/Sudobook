import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort safety net — without this, any uncaught render error unmounts
 * the entire React tree to a blank white screen with no way back in. Data
 * already committed to Dexie is untouched either way (this only guards the
 * UI layer), but a recoverable screen matters a lot for a daily-use business
 * app where "blank screen, no idea what happened" is unacceptable.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReload = (): void => {
    this.setState({ error: null });
    window.location.assign('/');
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-app px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-danger/30 bg-danger/10">
          <AlertTriangle className="h-6 w-6 text-danger" />
        </div>
        <h1 className="mt-4 text-base font-semibold text-foreground">Something went wrong</h1>
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-5 flex min-h-[48px] items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover active:bg-brand-active"
        >
          <RotateCcw className="h-4 w-4" />
          Reload app
        </button>
        <details className="mt-6 max-w-sm text-left">
          <summary className="cursor-pointer text-xs text-disabled">Technical details</summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-border-app/50 bg-surface p-2 text-left text-[10px] leading-snug text-muted">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
        </details>
      </div>
    );
  }
}
