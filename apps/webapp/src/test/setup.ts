import { type ReactNode } from 'react';
import { vi } from 'vitest';

// Stub the walletConnect connector at the module level. Its real implementation
// (Reown AppKit) fires a `pulse.walletconnect.org/batch` telemetry POST at
// instantiation. Because `data/wagmi/config/config.default.ts` builds its
// `connectors` array eagerly at module load, any test file that transitively
// imports something from that module (e.g. the `tenderly` chain const, used by
// tokenListConfig, lib/utils, etc.) triggers the telemetry POST. When happy-dom
// tears the window down while that fetch is in flight, the resulting rejection
// is reported as an unhandled error and fails `vitest run --coverage` even when
// every test passes. Tests use the `mock` connector via WagmiWrapper, so the
// real walletConnect is never exercised — replacing it with `mock` is safe.
vi.mock('wagmi/connectors', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi/connectors')>();
  return {
    ...actual,
    walletConnect: () => actual.mock({ accounts: ['0x0000000000000000000000000000000000000000'] })
  };
});

// posthog-js self-initializes at module import (PostHogProvider.tsx module scope)
// whenever the local .env enables it, so any test that transitively imports the
// analytics module fires real telemetry fetches that happy-dom aborts at window
// teardown — the same unhandled-rejection failure mode as walletConnect above.
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    register: vi.fn(),
    reset: vi.fn(),
    opt_in_capturing: vi.fn(),
    set_config: vi.fn()
  }
}));

vi.mock('@sentry/react', async () => {
  const React = await import('react');
  const withScope = vi.fn(
    (
      callback: (scope: {
        setContext: (name: string, context: Record<string, unknown>) => void;
        setExtras: (extras: Record<string, unknown>) => void;
        setLevel: (level: string) => void;
        setTag: (key: string, value: string) => void;
      }) => void
    ) =>
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
    tanstackRouterBrowserTracingIntegration: vi.fn(() => ({})),
    withScope
  };
});
