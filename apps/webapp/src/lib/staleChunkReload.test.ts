import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installStaleChunkReload } from './staleChunkReload';

const firePreloadError = () => {
  const event = new Event('vite:preloadError', { cancelable: true });
  window.dispatchEvent(event);
  return event;
};

describe('installStaleChunkReload', () => {
  let uninstall = () => {};
  const install = (deps: Parameters<typeof installStaleChunkReload>[0]) => {
    uninstall = installStaleChunkReload(deps);
  };

  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    uninstall();
    vi.restoreAllMocks();
  });

  it('reloads on the first chunk-load failure and marks the rejection handled', () => {
    const reload = vi.fn();
    install({ reload, now: () => 1_000_000 });

    const event = firePreloadError();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not reload again inside the window', () => {
    const reload = vi.fn();
    let time = 1_000_000;
    install({ reload, now: () => time });

    firePreloadError();
    time += 30_000;
    const event = firePreloadError();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('reloads again once the window has passed', () => {
    const reload = vi.fn();
    let time = 1_000_000;
    install({ reload, now: () => time });

    firePreloadError();
    time += 61_000;
    firePreloadError();

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('honours a reload recorded before this page load', () => {
    sessionStorage.setItem('staleChunkReloadedAt', '1000000');
    const reload = vi.fn();
    install({ reload, now: () => 1_010_000 });

    firePreloadError();

    expect(reload).not.toHaveBeenCalled();
  });

  it('never reloads when the guard cannot be stored', () => {
    const reload = vi.fn();
    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    install({ reload, now: () => 1_000_000 });

    firePreloadError();

    expect(reload).not.toHaveBeenCalled();
  });
});
