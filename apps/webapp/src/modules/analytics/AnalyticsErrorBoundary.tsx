import React from 'react';
import { reportError } from '@/modules/sentry/reportError';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Reports render errors from the analytics provider layer, then renders the
 * children again unchanged so a transient throw recovers. A child that throws
 * on every render re-throws past this boundary.
 */
export class AnalyticsErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, {
      module: 'analytics',
      flow: 'render',
      action: 'AnalyticsErrorBoundary',
      type: 'error-boundary',
      contexts: { react: { componentStack: info.componentStack } }
    });
  }

  render() {
    return this.props.children;
  }
}
