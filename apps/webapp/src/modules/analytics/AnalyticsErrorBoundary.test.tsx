import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsErrorBoundary } from './AnalyticsErrorBoundary';
import { reportError } from '@/modules/sentry/reportError';

vi.mock('@/modules/sentry/reportError', () => ({
  reportError: vi.fn()
}));

describe('AnalyticsErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // Sentry WEBAPP-DP / WEBAPP-D4: the boundary used to hand the reporter a
  // wrapper object, so every event was titled "Error: [object Object]".
  it('reports the thrown error itself, with the component stack as context', () => {
    const error = new Error('analytics exploded');
    const boundary = new AnalyticsErrorBoundary({ children: null });

    boundary.componentDidCatch(error, { componentStack: '\n    at Thrower' });

    expect(reportError).toHaveBeenCalledTimes(1);
    const [reported, ctx] = vi.mocked(reportError).mock.calls[0];
    expect(reported).toBe(error);
    expect(ctx.action).toBe('AnalyticsErrorBoundary');
    expect(ctx.contexts).toEqual({ react: { componentStack: '\n    at Thrower' } });
  });
});
