import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { installStaleChunkReload } from './staleChunkReload';

const T0 = new Date('2026-09-16T12:00:00Z');

const firePreloadError = () => {
  const event = new Event('vite:preloadError', { cancelable: true });
  window.dispatchEvent(event);
  return event;
};

describe('installStaleChunkReload', () => {
  let reload: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    installStaleChunkReload();
  });

  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterAll(() => {
    sessionStorage.clear();
  });

  it('reloads on the first chunk-load failure and leaves the rejection to its caller', () => {
    const event = firePreloadError();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
    expect(sessionStorage.getItem('staleChunkReloadedAt')).toBe(String(T0.getTime()));
  });

  it('does not reload again inside the window', () => {
    firePreloadError();
    vi.advanceTimersByTime(30_000);
    firePreloadError();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads again once the window has passed', () => {
    firePreloadError();
    vi.advanceTimersByTime(61_000);
    firePreloadError();

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('honours a reload recorded before this page load', () => {
    sessionStorage.setItem('staleChunkReloadedAt', String(T0.getTime() - 10_000));

    firePreloadError();

    expect(reload).not.toHaveBeenCalled();
  });

  it('stays guarded when the clock steps backwards after a reload', () => {
    firePreloadError();
    vi.setSystemTime(new Date(T0.getTime() - 30_000));
    firePreloadError();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads when the guard cannot be stored', () => {
    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    firePreloadError();

    expect(reload).not.toHaveBeenCalled();
  });
});
