import React from 'react';
import { Intent } from '@/lib/enums';
import { markModuleBlocked, ChunkBlockedError } from '@/lib/restricted-modules';

interface ChunkErrorBoundaryProps {
  /** The intent associated with this chunk */
  intent: Intent;
  /** Children to render */
  children: React.ReactNode;
  /** Fallback to render on error (defaults to null for blocked chunks) */
  fallback?: React.ReactNode;
  /** Callback when a chunk is detected as blocked */
  onBlocked?: (intent: Intent) => void;
}

interface ChunkErrorBoundaryState {
  hasError: boolean;
  isBlocked: boolean;
}

/**
 * Error boundary specifically designed for handling chunk load failures
 * from Cloudflare WAF blocking (403 responses).
 *
 * When a chunk is blocked:
 * 1. Marks the module as blocked in the global state
 * 2. Renders null (hides the component)
 * 3. Optionally calls onBlocked callback
 *
 * For other errors, renders the fallback or null.
 */
export class ChunkErrorBoundary extends React.Component<ChunkErrorBoundaryProps, ChunkErrorBoundaryState> {
  constructor(props: ChunkErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, isBlocked: false };
  }

  static getDerivedStateFromError(error: Error): ChunkErrorBoundaryState {
    // Check if this is a chunk blocked error
    const isBlocked = isChunkBlockedError(error);
    return { hasError: true, isBlocked };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { intent, onBlocked } = this.props;

    if (isChunkBlockedError(error)) {
      // Mark the module as blocked
      markModuleBlocked(intent);

      // Call the onBlocked callback if provided
      onBlocked?.(intent);

      // Log for debugging
      if (import.meta.env.DEV) {
        console.info(`[ChunkErrorBoundary] Module ${intent} blocked by WAF (403)`);
      }
    } else {
      // Log other errors
      console.error('[ChunkErrorBoundary] Error loading chunk:', error, errorInfo);
    }
  }

  render() {
    const { hasError, isBlocked } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // For blocked chunks, render null to hide the component
      if (isBlocked) {
        return null;
      }
      // For other errors, render fallback or null
      return fallback ?? null;
    }

    return children;
  }
}

/**
 * Check if an error indicates a chunk was blocked by WAF
 */
function isChunkBlockedError(error: Error): boolean {
  if (error instanceof ChunkBlockedError) {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('403') ||
    message.includes('failed to fetch') ||
    message.includes('loading chunk') ||
    message.includes('importing a module script failed') ||
    message.includes('dynamically imported module')
  );
}

/**
 * HOC to wrap a lazy component with ChunkErrorBoundary
 */
export function withChunkErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  intent: Intent,
  onBlocked?: (intent: Intent) => void
): React.FC<P> {
  const WrappedComponent: React.FC<P> = props => (
    <ChunkErrorBoundary intent={intent} onBlocked={onBlocked}>
      <Component {...props} />
    </ChunkErrorBoundary>
  );

  WrappedComponent.displayName = `withChunkErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}
