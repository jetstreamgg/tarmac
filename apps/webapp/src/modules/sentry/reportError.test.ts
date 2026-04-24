import * as Sentry from '@sentry/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportError } from './reportError';

describe('reportError', () => {
  const setTag = vi.fn();
  const setLevel = vi.fn();
  const setExtras = vi.fn();
  const setContext = vi.fn();
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(Sentry.withScope).mockImplementation(callback => {
      callback({
        setTag,
        setLevel,
        setExtras,
        setContext
      } as never);
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
