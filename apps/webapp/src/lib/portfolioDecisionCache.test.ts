import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PORTFOLIO_DECISION_TTL_MS,
  hasAnyPortfolioDecision,
  readPortfolioDecision,
  writePortfolioDecision
} from './portfolioDecisionCache';

const ADDRESS = '0xAbCd000000000000000000000000000000000001';
const OTHER = '0x0000000000000000000000000000000000000002';

const rawKey = (address: string) => `portfolioDecision:v1:${address.toLowerCase()}`;

afterEach(() => {
  localStorage.clear();
});

describe('portfolioDecisionCache', () => {
  it('round-trips a decision and stamps updatedAt', () => {
    const before = Date.now();
    writePortfolioDecision(ADDRESS, { outcome: 'allocate', tab: 'idle' });
    const read = readPortfolioDecision(ADDRESS);
    expect(read).not.toBeNull();
    expect(read?.outcome).toBe('allocate');
    expect(read?.tab).toBe('idle');
    expect(read?.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('is keyed per address, case-insensitively', () => {
    writePortfolioDecision(ADDRESS, { outcome: 'none', tab: 'supplied' });
    expect(readPortfolioDecision(OTHER)).toBeNull();
    expect(readPortfolioDecision(ADDRESS.toUpperCase().replace('0X', '0x'))?.outcome).toBe('none');
    expect(readPortfolioDecision(undefined)).toBeNull();
  });

  it('treats an entry past the TTL as absent and clears it', () => {
    localStorage.setItem(
      rawKey(ADDRESS),
      JSON.stringify({
        outcome: 'simulate',
        tab: 'idle',
        updatedAt: Date.now() - PORTFOLIO_DECISION_TTL_MS - 1000
      })
    );
    expect(readPortfolioDecision(ADDRESS)).toBeNull();
    expect(localStorage.getItem(rawKey(ADDRESS))).toBeNull();
  });

  it('keeps an entry just inside the TTL', () => {
    localStorage.setItem(
      rawKey(ADDRESS),
      JSON.stringify({
        outcome: 'simulate',
        tab: 'idle',
        updatedAt: Date.now() - PORTFOLIO_DECISION_TTL_MS + 60_000
      })
    );
    expect(readPortfolioDecision(ADDRESS)?.outcome).toBe('simulate');
  });

  it('rejects corrupt or unexpected payloads', () => {
    localStorage.setItem(rawKey(ADDRESS), 'not json at all');
    expect(readPortfolioDecision(ADDRESS)).toBeNull();

    localStorage.setItem(rawKey(ADDRESS), JSON.stringify({ outcome: 'jackpot', tab: 'idle', updatedAt: 1 }));
    expect(readPortfolioDecision(ADDRESS)).toBeNull();

    localStorage.setItem(
      rawKey(ADDRESS),
      JSON.stringify({ outcome: 'none', tab: 'idle', updatedAt: 'yesterday' })
    );
    expect(readPortfolioDecision(ADDRESS)).toBeNull();
  });

  it('ignores entries written under a different version prefix', () => {
    localStorage.setItem(
      `portfolioDecision:v0:${ADDRESS.toLowerCase()}`,
      JSON.stringify({ outcome: 'none', tab: 'supplied', updatedAt: Date.now() })
    );
    expect(readPortfolioDecision(ADDRESS)).toBeNull();
    expect(hasAnyPortfolioDecision()).toBe(false);
  });

  it('hasAnyPortfolioDecision sees any address, even expired ones', () => {
    expect(hasAnyPortfolioDecision()).toBe(false);
    localStorage.setItem(rawKey(OTHER), JSON.stringify({ outcome: 'none', tab: 'supplied', updatedAt: 0 }));
    expect(hasAnyPortfolioDecision()).toBe(true);
  });

  it('degrades to no-cache when storage is unusable (private mode)', () => {
    const boom = () => {
      throw new Error('denied');
    };
    vi.spyOn(localStorage, 'getItem').mockImplementation(boom);
    vi.spyOn(localStorage, 'setItem').mockImplementation(boom);
    vi.spyOn(localStorage, 'key').mockImplementation(boom);

    expect(() => writePortfolioDecision(ADDRESS, { outcome: 'none', tab: 'supplied' })).not.toThrow();
    expect(readPortfolioDecision(ADDRESS)).toBeNull();
    expect(hasAnyPortfolioDecision()).toBe(false);

    vi.restoreAllMocks();
  });
});
