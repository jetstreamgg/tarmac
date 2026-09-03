import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clampNetworkFilter,
  getNetworkFilter,
  resetNetworkFilterForTests,
  setNetworkFilter,
  subscribeNetworkFilter
} from './networkFilter';

const STORAGE_KEY = 'skyNetworkFilter';

beforeEach(() => {
  localStorage.clear();
  resetNetworkFilterForTests();
});

describe('networkFilter store', () => {
  it('defaults to "All networks"', () => {
    expect(getNetworkFilter()).toBeNull();
  });

  it('persists a selection and clears the entry on reset', () => {
    setNetworkFilter(8453);

    expect(getNetworkFilter()).toBe(8453);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('8453');

    setNetworkFilter(null);

    expect(getNetworkFilter()).toBeNull();
    // Removed rather than stored as "null", so a fresh browser and a cleared
    // filter read identically.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('notifies subscribers on change, and only on a real change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNetworkFilter(listener);

    setNetworkFilter(1);
    expect(listener).toHaveBeenCalledTimes(1);

    // Re-selecting the active network must not wake every consumer.
    setNetworkFilter(1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setNetworkFilter(8453);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('picks up a change from another tab', () => {
    const listener = vi.fn();
    subscribeNetworkFilter(listener);

    localStorage.setItem(STORAGE_KEY, '42161');
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));

    expect(getNetworkFilter()).toBe(42161);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('clampNetworkFilter', () => {
  const FAMILY = [1, 8453, 42161];

  it('passes a chain the family offers through', () => {
    expect(clampNetworkFilter(8453, FAMILY)).toBe(8453);
    expect(clampNetworkFilter(null, FAMILY)).toBeNull();
  });

  it('reads a chain outside the family as "All networks"', () => {
    // The dev fork carried into a production session, or a retired chain: the
    // filter must not silently empty every table.
    expect(clampNetworkFilter(314310, FAMILY)).toBeNull();
  });

  it('does not rewrite storage — the value survives a family change', () => {
    setNetworkFilter(8453);

    // A session on the Tenderly fork narrows the family to the fork alone.
    expect(clampNetworkFilter(getNetworkFilter(), [314310])).toBeNull();
    // ...and coming back restores what the user picked.
    expect(clampNetworkFilter(getNetworkFilter(), FAMILY)).toBe(8453);
  });
});
