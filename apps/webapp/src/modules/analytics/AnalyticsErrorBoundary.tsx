import React from 'react';
import { reportAnalyticsError } from './constants';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Error boundary that catches rendering errors in analytics components.
 * Always renders children on error — never shows a blank screen.
 */
export class AnalyticsErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportAnalyticsError('AnalyticsErrorBoundary', error, {
      react: { componentStack: info.componentStack }
    });
  }

  render() {
    // Always render children — analytics errors should never break the UI
    return this.props.children;
  }
}
