/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lastCompleteScan, markCompleteScan } from './recoveryScanStamp';

describe('recoveryScanStamp', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('reads back the time of the last complete scan, per kind and scope', () => {
    markCompleteScan('withdrawal', 'scope-1', 1_000);
    expect(lastCompleteScan('withdrawal', 'scope-1')).toBe(1_000);
    expect(lastCompleteScan('deposit', 'scope-1')).toBeUndefined();
    expect(lastCompleteScan('withdrawal', 'scope-2')).toBeUndefined();
  });

  it('knows no scan when storage holds garbage or throws', () => {
    localStorage.setItem('bridgeRecoveryScan:v1:withdrawal:scope-1', 'soon');
    expect(lastCompleteScan('withdrawal', 'scope-1')).toBeUndefined();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(lastCompleteScan('withdrawal', 'scope-1')).toBeUndefined();
  });

  it('drops a stamp storage refuses', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(() => markCompleteScan('withdrawal', 'scope-1', 1_000)).not.toThrow();
  });
});
