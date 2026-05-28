import { describe, expect, it } from 'vitest';
import { normalizePendlePnlRows } from './usePendleAllPnlTransactions';
import { PendleHistoryAction } from './constants';
import type { PendlePnlTransactionRaw } from './pendle';

// PT-sUSDS is the only market wired into PENDLE_MARKETS — resolveMarket() picks
// it up from its address. Anything else would be filtered as "unsupported."
const PT_SUSDS_MARKET_ADDRESS = '0x9c560ebaf78e596cbcc27411d633a74d628dd7dc';

function row(overrides: Partial<PendlePnlTransactionRaw> = {}): PendlePnlTransactionRaw {
  return {
    txHash: '0xabc',
    timestamp: '2026-04-01T00:00:00Z',
    market: PT_SUSDS_MARKET_ADDRESS,
    action: 'buyPt',
    txValueAsset: 100,
    assetUsd: 1,
    effectivePtExchangeRate: 0.995,
    ...overrides
  } as PendlePnlTransactionRaw;
}

describe('normalizePendlePnlRows', () => {
  it('emits a single normalized row for a healthy buyPt', () => {
    const out = normalizePendlePnlRows([row()]);
    expect(out).toHaveLength(1);
    expect(out[0].action).toBe(PendleHistoryAction.BUY_PT);
    // ptAmount = txValueAsset * effectivePtExchangeRate
    expect(out[0].ptAmount).toBeCloseTo(99.5, 10);
    expect(out[0].valueUsd).toBeCloseTo(100, 10);
  });

  it('emits one row per supported action', () => {
    const out = normalizePendlePnlRows([
      row({ action: 'buyPt', txHash: '0x1' }),
      row({ action: 'sellPt', txHash: '0x2' }),
      row({ action: 'redeemPy', txHash: '0x3' })
    ]);
    expect(out.map(r => r.action)).toEqual([
      PendleHistoryAction.BUY_PT,
      PendleHistoryAction.SELL_PT,
      PendleHistoryAction.REDEEM_PY
    ]);
  });

  it('drops rows with NaN txValueAsset', () => {
    const out = normalizePendlePnlRows([row({ txValueAsset: NaN }), row({ txHash: '0xok' })]);
    expect(out).toHaveLength(1);
    expect(out[0].txHash).toBe('0xok');
  });

  it('drops rows with missing/null effectivePtExchangeRate on a buy/sell', () => {
    const out = normalizePendlePnlRows([
      row({ effectivePtExchangeRate: null as unknown as number }),
      row({ effectivePtExchangeRate: undefined as unknown as number, txHash: '0xb' }),
      row({ txHash: '0xok' })
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].txHash).toBe('0xok');
  });

  it('drops rows with NaN assetUsd', () => {
    const out = normalizePendlePnlRows([row({ assetUsd: NaN })]);
    expect(out).toHaveLength(0);
  });

  it('keeps a redeemPy row even with missing effectivePtExchangeRate (not used for redeems)', () => {
    const out = normalizePendlePnlRows([
      row({
        action: 'redeemPy',
        effectivePtExchangeRate: undefined as unknown as number,
        txValueAsset: 6143.99,
        assetUsd: 1
      })
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].ptAmount).toBe(6143.99);
  });

  it('drops redeemPy rows with non-positive txValueAsset (YT-only redeem)', () => {
    const out = normalizePendlePnlRows([row({ action: 'redeemPy', txValueAsset: 0 })]);
    expect(out).toHaveLength(0);
  });

  it('drops rows from markets not in PENDLE_MARKETS', () => {
    const out = normalizePendlePnlRows([row({ market: '0x0000000000000000000000000000000000000000' })]);
    expect(out).toHaveLength(0);
  });

  it('drops rows for actions we do not surface (mintPy, addLiquidity, …)', () => {
    const out = normalizePendlePnlRows([row({ action: 'mintPy' }), row({ action: 'addLiquidity' })]);
    expect(out).toHaveLength(0);
  });

  it('sorts surviving rows descending by timestamp', () => {
    const out = normalizePendlePnlRows([
      row({ timestamp: '2026-01-01T00:00:00Z', txHash: '0xold' }),
      row({ timestamp: '2026-03-01T00:00:00Z', txHash: '0xnew' }),
      row({ timestamp: '2026-02-01T00:00:00Z', txHash: '0xmid' })
    ]);
    expect(out.map(r => r.txHash)).toEqual(['0xnew', '0xmid', '0xold']);
  });

  it('accepts the alternate "<chainId>-<address>" market wire form', () => {
    const out = normalizePendlePnlRows([row({ market: `1-${PT_SUSDS_MARKET_ADDRESS}` })]);
    expect(out).toHaveLength(1);
    expect(out[0].market.marketAddress.toLowerCase()).toBe(PT_SUSDS_MARKET_ADDRESS);
  });
});
