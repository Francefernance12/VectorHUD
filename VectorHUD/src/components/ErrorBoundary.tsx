import { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * React Error Boundary that catches render errors in widget trees
 * and forwards them to the Rust tracing logger for unified crash reporting.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const componentStack = info.componentStack ?? 'unknown';
    logger.error(
      `[ErrorBoundary] Uncaught render error: ${error.message}\nComponent Stack: ${componentStack}`
    );
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full p-4 font-mono text-xs">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-red-400 font-bold tracking-widest uppercase">
              WIDGET ERROR
            </span>
            <span className="text-zinc-500 max-w-[200px] break-words">
              {this.state.errorMessage || this.props.fallbackMessage || 'An unexpected error occurred.'}
            </span>
            <button
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="mt-2 px-3 py-1 border border-border-wire rounded-sm text-zinc-400 hover:text-accent-amber hover:border-accent-amber transition-colors"
            >
              RETRY
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
