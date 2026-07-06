import { describe, expect, it } from 'vitest';
import { formatUnits } from 'viem';
import { normalizeSparkCurrentData, normalizeSparkHistoricData } from './normalizeSparkVaultData';
import type { SparkSavingsCurrentResponse, SparkSavingsHistoricResponse } from './sparkSavingsApi';

const VAULT = '0x74cb54e082411cfCAEADb00a0765625B10410DAa';

/**
 * Real current payload for our vault (`sky/mainnet/usdt`), captured live
 * 2026-06-03. Dormant: apy "0", tiny TVL, liquidity spread across sources, and
 * collateralComposition with a single non-zero `usdt → Idle` bucket.
 */
const REAL_DORMANT_PAYLOAD: SparkSavingsCurrentResponse = {
  data: {
    vault: { address: VAULT, decimals: 6, symbol: 'sUSDT', name: 'Tether Savings' },
    asset: {
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
      symbol: 'USDT',
      name: 'Tether USD'
    },
    apy: '0',
    tvl: '101.3251',
    users: 3,
    depositCap: '500000000',
    liquidity: [
      { protocol: 'idle', value: '46.6279365548235422517065424' },
      { protocol: 'sparklend', value: '8.7576172174507242680043678' },
      { protocol: 'morpho', value: '4.8478976953959054020511357510423589224' },
      { protocol: 'curve', value: '3.3428594357439990507955067424825711366' }
    ],
    collateralComposition: {
      usds: [
        { category: 'Stablecoins', value: '0' },
        { category: 'Onchain Crypto Lending', value: '0' },
        { category: 'Short Duration Treasury Bills', value: '0' },
        { category: 'OTC Crypto Lending', value: '0' },
        { category: 'AAA Corporate Debt', value: '0' },
        { category: 'Other', value: '0' },
        { category: 'Private Credit', value: '0' },
        { category: 'Basis Trade', value: '0' }
      ],
      usdt: [{ category: 'Idle', value: '101.3251' }]
    }
  }
};

describe('normalizeSparkCurrentData', () => {
  it('maps the real dormant payload: 0% rate, TVL, summed liquidity, single Idle allocation, 0% fees', () => {
    const result = normalizeSparkCurrentData(REAL_DORMANT_PAYLOAD, VAULT);

    // tvl "101.3251" parsed with the asset's 6 decimals (NOT raw BigInt).
    expect(result?.totalAssets).toBe(101_325_100n);

    // apy "0" is a genuine zero rate (present, not missing).
    expect(result?.rate?.rate).toBe(0);
    expect(result?.rate?.netRate).toBe(0);
    expect(result?.rate?.address).toBe(VAULT);
    // Spark exposes no fee split → 0%/0%, single net rate.
    expect(result?.rate?.managementFee).toBe(0);
    expect(result?.rate?.performanceFee).toBe(0);
    expect(result?.rate?.rewards).toEqual([]);

    // liquidity[] summed into a single vault-level figure (≈ 63.58 USDT).
    expect(result?.liquidity).toBe(63_576_309n);

    // Zero-valued usds categories dropped → just the real usdt → Idle bucket at 100%.
    expect(result?.allocations).toHaveLength(1);
    expect(result?.allocations?.[0]).toEqual({
      name: 'Idle',
      assets: 101_325_100n,
      allocationPercent: 1
    });

    // depositCap "500000000" parsed with 6 decimals.
    expect(result?.depositCap).toBe(500_000_000_000_000n);
  });

  it('maps a populated multi-allocation payload with correct rate/TVL/shares', () => {
    const payload: SparkSavingsCurrentResponse = {
      data: {
        asset: { address: '0x0', decimals: 6, symbol: 'USDT', name: 'Tether USD' },
        apy: '0.0531',
        tvl: '250',
        depositCap: '1000',
        liquidity: [
          { protocol: 'idle', value: '100' },
          { protocol: 'sparklend', value: '50' }
        ],
        collateralComposition: {
          usdt: [
            { category: 'Spark Liquidity Layer', value: '200' },
            { category: 'Idle', value: '50' }
          ]
        }
      }
    };

    const result = normalizeSparkCurrentData(payload, VAULT);

    expect(result?.totalAssets).toBe(250_000_000n);
    expect(result?.rate?.rate).toBe(0.0531);
    expect(result?.rate?.formattedNetRate).toBe('5.31%');
    expect(result?.liquidity).toBe(150_000_000n);
    expect(result?.depositCap).toBe(1_000_000_000n);
    expect(result?.allocations).toEqual([
      { name: 'Spark Liquidity Layer', assets: 200_000_000n, allocationPercent: 0.8 },
      { name: 'Idle', assets: 50_000_000n, allocationPercent: 0.2 }
    ]);
  });

  it('unwraps the data envelope: a payload without it is empty', () => {
    expect(normalizeSparkCurrentData({} as SparkSavingsCurrentResponse, VAULT)).toBeUndefined();
    expect(normalizeSparkCurrentData(null, VAULT)).toBeUndefined();
    expect(normalizeSparkCurrentData(undefined, VAULT)).toBeUndefined();
  });

  it('returns a clean empty state for an empty/all-blank data envelope', () => {
    expect(normalizeSparkCurrentData({ data: {} }, VAULT)).toBeUndefined();
    expect(
      normalizeSparkCurrentData(
        { data: { apy: '', tvl: '', depositCap: '', liquidity: [], collateralComposition: {} } },
        VAULT
      )
    ).toBeUndefined();
  });

  it('parses decimal strings with the asset decimals, falling back to 18 when absent', () => {
    // No asset descriptor → default 18 decimals.
    const result = normalizeSparkCurrentData({ data: { tvl: '1.5' } }, VAULT);
    expect(result?.totalAssets).toBe(1_500_000_000_000_000_000n);
  });

  it('aggregates same-category buckets across collateral symbols', () => {
    const result = normalizeSparkCurrentData(
      {
        data: {
          asset: { address: '0x0', decimals: 6, symbol: 'USDT', name: 'Tether USD' },
          tvl: '300',
          collateralComposition: {
            usds: [{ category: 'Idle', value: '100' }],
            usdt: [{ category: 'Idle', value: '200' }]
          }
        }
      },
      VAULT
    );

    expect(result?.allocations).toHaveLength(1);
    expect(result?.allocations?.[0]).toEqual({ name: 'Idle', assets: 300_000_000n, allocationPercent: 1 });
  });

  it('tolerates garbage without throwing: bad TVL/liquidity/allocation dropped, rate survives', () => {
    const result = normalizeSparkCurrentData(
      {
        data: {
          asset: { address: '0x0', decimals: 6, symbol: 'USDT', name: 'Tether USD' },
          apy: '0.05',
          tvl: 'not-a-number',
          liquidity: [
            { protocol: 'idle', value: 'oops' },
            { protocol: 'sparklend', value: '10' }
          ],
          collateralComposition: {
            usdt: [
              { category: 'bad', value: 'nope' },
              { category: 'good', value: '5' }
            ]
          }
        }
      },
      VAULT
    );

    expect(result?.totalAssets).toBeUndefined();
    expect(result?.rate?.rate).toBe(0.05);
    // Only the parseable liquidity source counts.
    expect(result?.liquidity).toBe(10_000_000n);
    // Only the parseable allocation survives; share undefined without a TVL.
    expect(result?.allocations).toHaveLength(1);
    expect(result?.allocations?.[0]).toMatchObject({ name: 'good', assets: 5_000_000n });
    expect(result?.allocations?.[0].allocationPercent).toBeUndefined();
  });

  it('treats a blank/non-numeric apy as missing but a "0" apy as a genuine zero', () => {
    expect(normalizeSparkCurrentData({ data: { apy: '', tvl: '1' } }, VAULT)?.rate).toBeUndefined();
    expect(normalizeSparkCurrentData({ data: { apy: 'abc', tvl: '1' } }, VAULT)?.rate).toBeUndefined();
    expect(normalizeSparkCurrentData({ data: { apy: '0', tvl: '1' } }, VAULT)?.rate?.rate).toBe(0);
  });

  it('truncates excess fractional precision rather than rejecting high-precision strings', () => {
    const result = normalizeSparkCurrentData(
      {
        data: {
          asset: { address: '0x0', decimals: 6, symbol: 'USDT', name: 'Tether USD' },
          liquidity: [{ protocol: 'idle', value: '46.6279365548235422517065424' }]
        }
      },
      VAULT
    );
    // Truncated to 6 decimals: 46.627936 → 46627936.
    expect(result?.liquidity).toBe(46_627_936n);
    expect(formatUnits(result?.liquidity ?? 0n, 6)).toBe('46.627936');
  });
});

describe('normalizeSparkHistoricData', () => {
  // ISO UTC-midnight timestamps for the daily fixture points (asset has 6 decimals).
  const T_JUN1 = Math.floor(Date.UTC(2026, 5, 1) / 1000);
  const T_JUN2 = Math.floor(Date.UTC(2026, 5, 2) / 1000);
  const T_JUN3 = Math.floor(Date.UTC(2026, 5, 3) / 1000);

  it('maps a populated daily series to ordered history points (date→ts, tvl→amount, apy→decimal)', () => {
    // Mirrors the live `{ data: [{ date, apy, tvl }] }` shape — supplied out of order.
    const response: SparkSavingsHistoricResponse = {
      data: [
        { date: '2026-06-02T00:00:00.000Z', apy: '0.0531', tvl: '200' },
        { date: '2026-06-01T00:00:00.000Z', apy: '0.04', tvl: '100' },
        { date: '2026-06-03T00:00:00.000Z', apy: '0.06', tvl: '300' }
      ]
    };

    const points = normalizeSparkHistoricData(response, 6);

    expect(points).toEqual([
      { blockTimestamp: T_JUN1, amount: 100_000_000n, amountUsd: 0, apy: 0.04 },
      { blockTimestamp: T_JUN2, amount: 200_000_000n, amountUsd: 0, apy: 0.0531 },
      { blockTimestamp: T_JUN3, amount: 300_000_000n, amountUsd: 0, apy: 0.06 }
    ]);
  });

  it('yields an empty (not errored) series for our dormant vault’s empty data array', () => {
    expect(normalizeSparkHistoricData({ data: [] }, 6)).toEqual([]);
  });

  it('yields an empty series for a missing/null/undefined payload without throwing', () => {
    expect(normalizeSparkHistoricData({}, 6)).toEqual([]);
    expect(normalizeSparkHistoricData(null, 6)).toEqual([]);
    expect(normalizeSparkHistoricData(undefined, 6)).toEqual([]);
  });

  it('falls back to 18 decimals when none supplied', () => {
    const points = normalizeSparkHistoricData({ data: [{ date: '2026-06-01T00:00:00.000Z', tvl: '1.5' }] });
    expect(points).toEqual([
      { blockTimestamp: T_JUN1, amount: 1_500_000_000_000_000_000n, amountUsd: 0, apy: undefined }
    ]);
  });

  it('drops entries with an unparseable date or TVL but keeps the valid ones', () => {
    const points = normalizeSparkHistoricData(
      {
        data: [
          { date: 'not-a-date', apy: '0.05', tvl: '100' },
          { date: '2026-06-02T00:00:00.000Z', apy: '0.05', tvl: 'oops' },
          { date: '2026-06-01T00:00:00.000Z', apy: '', tvl: '100' }
        ]
      },
      6
    );

    // Only the third entry survives; blank apy normalizes to undefined.
    expect(points).toEqual([{ blockTimestamp: T_JUN1, amount: 100_000_000n, amountUsd: 0, apy: undefined }]);
  });
});
