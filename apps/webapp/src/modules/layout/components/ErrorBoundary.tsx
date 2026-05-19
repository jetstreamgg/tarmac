import React from 'react';
import { Error as ErrorView } from './Error';
import { reportError } from '@/modules/sentry/reportError';
interface Props {
  componentName?: string;
  children: React.ReactNode;
  variant?: 'large' | 'medium' | 'small';
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  componentName = 'component';
  variant: 'large' | 'small' | 'medium' = 'large';

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
    this.variant = props.variant || this.variant;
    this.componentName = props.componentName || this.componentName;
  }

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportError(error, {
      module: 'ui',
      flow: 'render',
      action: 'boundary-catch',
      type: 'error-boundary',
      extra: {
        boundary: this.componentName
      },
      contexts: {
        react: {
          componentStack: errorInfo.componentStack
        }
      }
    });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return <ErrorView variant={this.variant} />;
    }

    return this.props.children;
  }
}
