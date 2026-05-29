import * as Sentry from '@sentry/react';
import React from 'react';
import { Error } from './Error';

export class ErrorBoundary extends React.Component<{
  componentName?: string;
  children: React.ReactNode;
  variant?: 'large' | 'medium' | 'small';
}> {
  componentName = 'component';
  variant: 'large' | 'small' | 'medium' = 'large';

  constructor(props: {
    componentName?: string;
    children: React.ReactNode;
    variant?: 'large' | 'medium' | 'small';
  }) {
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
        type: 'react_error_boundary',
        source: 'sky_widgets'
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
    if ((this.state as any).hasError) {
      // You can render any custom fallback UI
      return <Error variant={this.variant} />;
    }

    return this.props.children;
  }
}
