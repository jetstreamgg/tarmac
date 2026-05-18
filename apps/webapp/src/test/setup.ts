import { type ReactNode } from 'react';
import { vi } from 'vitest';

// Reown AppKit (reached transitively via wagmi's walletConnect connector)
// fires a Pulse telemetry POST on init and the connector's QrModalOptions
// type doesn't expose `enableAnalytics`, so there's no way to opt out at the
// config layer. When happy-dom tears the window down while that fetch is in
// flight, the resulting rejection is reported as an unhandled error and
// fails `vitest run --coverage` even when every test passes. Short-circuit
// the URL so the race can't happen.
const originalFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (/pulse\.walletconnect\.org/.test(url)) {
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  return originalFetch(input as RequestInfo, init);
}) as typeof fetch;

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
