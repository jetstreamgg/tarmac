import { describe, expect, it, afterAll } from 'vitest';
import { cleanup, waitFor, renderHook } from '@testing-library/react';
import { WagmiWrapper } from '../../../test/hooks';

import { useEarnMarketplace } from './useEarnMarketplace';

describe('useEarnMarketplace', () => {
  it('returns one row per product instance with live data', async () => {
    const { result } = renderHook(() => useEarnMarketplace(), { wrapper: WagmiWrapper });

    // Static registry shape is available immediately, before any data lands.
    const ids = result.current.rows.map(row => row.id);
    expect(ids).toContain('savings');
    expect(ids).toContain('rewards-spk');
    expect(ids).toContain('stusds');
    expect(result.current.rows.filter(row => row.kind === 'vault').length).toBeGreaterThan(0);

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 60000 }
    );

    const byId = Object.fromEntries(result.current.rows.map(row => [row.id, row]));

    // Savings: SSR rate and a global TVL from BA Labs.
    expect(byId['savings'].rate.value).toBeGreaterThan(0);
    expect(byId['savings'].tvl?.totalUsd).toBeGreaterThan(0);

    // stUSDS: onchain str-derived rate, advanced risk tier.
    expect(byId['stusds'].risk).toBe('advanced');
    expect(byId['stusds'].rate.value).toBeGreaterThan(0);
    expect(byId['stusds'].tvl?.totalUsd).toBeGreaterThan(0);

    // Aggregate of all user positions (>= 0; the fork test account holds none).
    expect(result.current.totalDepositedUsd).toBeGreaterThanOrEqual(0);

    // Savings and stUSDS both have live BA Labs history behind them.
    expect(byId['savings'].rate30d.value).toBeGreaterThan(0);
    expect(byId['stusds'].rate30d.value).toBeGreaterThan(0);

    // Every row resolved without error and carries a formatted 30D rate — a
    // percentage where the product has history, '—' where it has none.
    for (const row of result.current.rows) {
      expect(row.error).toBeNull();
      expect(row.rate30d.formatted).toBeTruthy();
      expect(row.detailPath.startsWith('/')).toBe(true);
      expect(row.networks.length).toBeGreaterThan(0);
    }
  });

  afterAll(() => {
    cleanup();
  });
});
