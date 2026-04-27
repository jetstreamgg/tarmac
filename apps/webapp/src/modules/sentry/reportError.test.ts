import * as Sentry from '@sentry/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import { reportError } from './reportError';

type WithScopeCallback = (scope: {
  setTag: (key: string, value: string) => void;
  setLevel: (level: string) => void;
  setExtras: (extras: Record<string, unknown>) => void;
  setContext: (name: string, context: Record<string, unknown>) => void;
}) => void;

describe('reportError', () => {
  const setTag = vi.fn();
  const setLevel = vi.fn();
  const setExtras = vi.fn();
  const setContext = vi.fn();
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  beforeEach(() => {
    vi.clearAllMocks();

    const withScopeMock = vi.mocked(Sentry.withScope) as unknown as MockedFunction<
      (callback: WithScopeCallback) => void
    >;
    withScopeMock.mockImplementation(callback => {
      callback({
        setTag,
        setLevel,
        setExtras,
        setContext
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies tags, level, extras, and contexts before capturing', () => {
    const error = new Error('boom');

    reportError(error, {
      module: 'ui',
      flow: 'render',
      action: 'boundary-catch',
      type: 'error-boundary',
      statusCode: 503,
      level: 'warning',
      extra: { boundary: 'AppShell' },
      contexts: {
        react: {
          componentStack: '\n in AppShell'
        }
      }
    });

    expect(Sentry.withScope).toHaveBeenCalledTimes(1);
    expect(setTag).toHaveBeenCalledWith('module', 'ui');
    expect(setTag).toHaveBeenCalledWith('flow', 'render');
    expect(setTag).toHaveBeenCalledWith('action', 'boundary-catch');
    expect(setTag).toHaveBeenCalledWith('type', 'error-boundary');
    expect(setTag).toHaveBeenCalledWith('status_code', '503');
    expect(setLevel).toHaveBeenCalledWith('warning');
    expect(setExtras).toHaveBeenCalledWith({ boundary: 'AppShell' });
    expect(setContext).toHaveBeenCalledWith('react', {
      componentStack: '\n in AppShell'
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(consoleError).toHaveBeenCalledWith(error, {
      module: 'ui',
      flow: 'render',
      action: 'boundary-catch',
      type: 'error-boundary',
      statusCode: 503,
      level: 'warning',
      extra: { boundary: 'AppShell' },
      contexts: {
        react: {
          componentStack: '\n in AppShell'
        }
      }
    });
  });
});
