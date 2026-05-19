import { type ReactNode } from 'react';
import { vi } from 'vitest';

vi.mock('@sentry/react', async () => {
  const React = await import('react');
  const withScope = vi.fn((callback: (scope: {
    setContext: (name: string, context: Record<string, unknown>) => void;
    setExtras: (extras: Record<string, unknown>) => void;
    setLevel: (level: string) => void;
    setTag: (key: string, value: string) => void;
  }) => void) =>
    callback({
      setContext: vi.fn(),
      setExtras: vi.fn(),
      setLevel: vi.fn(),
      setTag: vi.fn()
    })
  );

  return {
    ErrorBoundary: ({ children }: { children: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    browserTracingIntegration: vi.fn(() => ({})),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    init: vi.fn(),
    reactRouterV6BrowserTracingIntegration: vi.fn(() => ({})),
    withScope,
    wrapCreateBrowserRouterV6: vi.fn(fn => fn)
  };
});
