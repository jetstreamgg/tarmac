import * as Sentry from '@sentry/react';
import React from 'react';
import { Error as ErrorView } from './Error';
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
    Sentry.captureException(error, {
      tags: {
        boundary: this.componentName,
        type: 'react_error_boundary'
      },
      contexts: {
        react: {
          componentStack: errorInfo.componentStack
        }
      }
    });

    console.error({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return <ErrorView variant={this.variant} />;
    }

    return this.props.children;
  }
}
