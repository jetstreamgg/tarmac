import { type ReactNode } from 'react';
import { vi } from 'vitest';

vi.mock('@sentry/react', async () => {
  const React = await import('react');

  return {
    ErrorBoundary: ({ children }: { children: ReactNode }) => React.createElement(React.Fragment, null, children),
    browserTracingIntegration: vi.fn(() => ({})),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    init: vi.fn(),
    reactRouterV6BrowserTracingIntegration: vi.fn(() => ({})),
    wrapCreateBrowserRouterV6: vi.fn(fn => fn)
  };
});
