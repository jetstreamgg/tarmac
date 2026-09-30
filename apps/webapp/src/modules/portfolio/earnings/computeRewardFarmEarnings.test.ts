import { describe, expect, it } from 'vitest';
import type { RewardFarmClaim } from '../../../hooks/rewards/rewardFarmEarnedClient';
import { computeRewardFarmMonth, computeRewardFarmTotal } from './computeRewardFarmEarnings';

const FARM = '0x173e314c7635b45322cd8cb14f44b312e079f3af';
const WAD = 10n ** 18n;
const DAY = 86400;
const SEP_1 = 1788220800; // 2026-09-01T00:00:00Z
const window = { startSec: SEP_1, endSec: SEP_1 + 30 * DAY - 1 };
const MONTH_START_BLOCK = 1000n;
const token = { symbol: 'SPK', decimals: 18 };

const claim = (amount: bigint, blockNumber: number, blockTimestamp: number): RewardFarmClaim => ({
  farm: FARM,
  amount: amount * WAD,
  blockNumber,
  blockTimestamp
});

// Aug 20 @ $0.2, Aug 31 (the close before the month) @ $0.25, Sep 5 @ $0.5.
const prices = new Map([
  ['2026-08-20', 0.2],
  ['2026-08-31', 0.25],
  ['2026-09-05', 0.5]
]);

describe('computeRewardFarmTotal', () => {
  it('values each claim at its claim day and the unclaimed balance at the current price', () => {
    // 10 × 0.2 + 4 × 0.5 + 2 unclaimed × 1 = 6, over 16 SPK.
    const figure = computeRewardFarmTotal({
      claims: [claim(10n, 900, SEP_1 - 12 * DAY), claim(4n, 1100, SEP_1 + 4 * DAY)],
      earnedNow: 2n * WAD,
      historicPrices: prices,
      currentPrice: 1,
      token
    });
    expect(figure).toEqual({ status: 'ok', value: { usd: 6, native: { amount: 16, symbol: 'SPK' } } });
  });

  it('falls back to the nearest earlier price when the claim day is missing from the series', () => {
    // Sep 7 has no row → Sep 5's $0.5.
    const figure = computeRewardFarmTotal({
      claims: [claim(4n, 1100, SEP_1 + 6 * DAY)],
      earnedNow: 0n,
      historicPrices: prices,
      currentPrice: 1,
      token
    });
    expect(figure).toEqual({ status: 'ok', value: { usd: 2, native: { amount: 4, symbol: 'SPK' } } });
  });

  it('reports a genuine $0 for a wallet that never earned from the farm', () => {
    expect(
      computeRewardFarmTotal({ claims: [], earnedNow: 0n, historicPrices: prices, currentPrice: 1, token })
    ).toEqual({ status: 'ok', value: { usd: 0 } });
  });

  it('degrades instead of guessing when a claim predates the price series', () => {
    const figure = computeRewardFarmTotal({
      claims: [claim(1n, 10, SEP_1 - 400 * DAY)],
      earnedNow: 0n,
      historicPrices: prices,
      currentPrice: 1,
      token
    });
    expect(figure).toEqual({ status: 'notAvailable', reason: 'reconciliation-failed' });
  });
});

describe('computeRewardFarmMonth', () => {
  const base = {
    historicPrices: prices,
    currentPrice: 1,
    token,
    monthStartBlock: MONTH_START_BLOCK,
    window
  };

  it('adds in-month claims and the balance change, valuing the opening balance at the prior close', () => {
    // In-month: 4 × 0.5 = 2; now 2 × 1 = 2; opening 3 × 0.25 = 0.75 → 3.25 over 4 + 2 − 3 = 3 SPK.
    const figure = computeRewardFarmMonth({
      ...base,
      claims: [claim(10n, 900, SEP_1 - 12 * DAY), claim(4n, 1100, SEP_1 + 4 * DAY)],
      earnedNow: 2n * WAD,
      earnedAtMonthStart: 3n * WAD
    });
    expect(figure).toEqual({ status: 'ok', value: { usd: 3.25, native: { amount: 3, symbol: 'SPK' } } });
  });

  it('splits claims by block, not timestamp: a claim in the month-start block counts as in-month', () => {
    // Same second as the window start but in the first in-window block.
    const figure = computeRewardFarmMonth({
      ...base,
      historicPrices: new Map([['2026-09-01', 1]]),
      claims: [claim(5n, Number(MONTH_START_BLOCK), SEP_1)],
      earnedNow: 0n,
      earnedAtMonthStart: 0n
    });
    expect(figure).toEqual({ status: 'ok', value: { usd: 5, native: { amount: 5, symbol: 'SPK' } } });
  });

  it('goes negative when the price fall on the opening balance outweighs the accrual', () => {
    // Nothing claimed; 10 open at $0.25 → 11 now at $0.1: 1.1 − 2.5 = −1.4 over +1 SPK.
    const figure = computeRewardFarmMonth({
      ...base,
      currentPrice: 0.1,
      claims: [],
      earnedNow: 11n * WAD,
      earnedAtMonthStart: 10n * WAD
    });
    expect(figure.status).toBe('ok');
    if (figure.status !== 'ok') return;
    expect(figure.value.usd).toBeCloseTo(-1.4, 10);
    expect(figure.value.native).toEqual({ amount: 1, symbol: 'SPK' });
  });

  it('degrades when balances and claims disagree (a claim the indexer has not seen yet)', () => {
    // The balance dropped from 3 to 0 but no in-month claim explains it.
    const figure = computeRewardFarmMonth({
      ...base,
      claims: [],
      earnedNow: 0n,
      earnedAtMonthStart: 3n * WAD
    });
    expect(figure).toEqual({ status: 'notAvailable', reason: 'reconciliation-failed' });
  });

  it('reports a genuine $0 when nothing accrued and nothing was open', () => {
    expect(computeRewardFarmMonth({ ...base, claims: [], earnedNow: 0n, earnedAtMonthStart: 0n })).toEqual({
      status: 'ok',
      value: { usd: 0 }
    });
  });
});
