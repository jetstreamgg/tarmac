/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isCctpSpendOpen } from './openCctpSpends';
import { clearSaleIntent, lostSaleIntent, markSaleIntent, openClaimedSale } from './saleIntentStore';
import { SEND_INTENT_MS } from './sendIntentStore';

const NOW = 1_800_000_000_000;

describe('saleIntentStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("keeps a card's sale prompt for 35 minutes, by card, whatever the hash's case", () => {
    markSaleIntent('scope', '0xABC', NOW);
    expect(lostSaleIntent('0xabc', NOW + SEND_INTENT_MS - 1)).toEqual({
      scope: 'scope',
      bridgeId: '0xABC',
      at: NOW
    });
    expect(lostSaleIntent('0xabc', NOW + SEND_INTENT_MS)).toBeUndefined();
    expect(lostSaleIntent('0xother', NOW)).toBeUndefined();
    // A stamp ahead of this clock isn't read.
    expect(lostSaleIntent('0xabc', NOW - 1)).toBeUndefined();
  });

  it("keeps a convert's amount, and reads by the minted amount when it isn't a whole number", () => {
    markSaleIntent('scope', '0xabc', NOW, 25n);
    expect(lostSaleIntent('0xabc', NOW)).toMatchObject({ amount: '25' });
    localStorage.setItem(
      'bridgeSaleIntent:v1',
      JSON.stringify([{ scope: 's', bridgeId: '0xabc', at: NOW, amount: '1.5' }])
    );
    // The prompt is kept: dropping it would offer Convert while it may still be signed.
    expect(lostSaleIntent('0xabc', NOW)).toEqual({ scope: 's', bridgeId: '0xabc', at: NOW });
  });

  it('clears only the prompt opened at that time', () => {
    markSaleIntent('scope', '0xabc', NOW);
    markSaleIntent('scope', '0xabc', NOW + 1);
    clearSaleIntent('0xABC', NOW + 1);
    expect(lostSaleIntent('0xabc', NOW + 2)).toMatchObject({ at: NOW });
  });

  it('drops entries it cannot read', () => {
    localStorage.setItem(
      'bridgeSaleIntent:v1',
      JSON.stringify([{ scope: 1 }, 'x', { scope: 's', bridgeId: '0xa', at: NOW }])
    );
    expect(lostSaleIntent('0xa', NOW)).toMatchObject({ bridgeId: '0xa' });
    localStorage.setItem('bridgeSaleIntent:v1', '{');
    expect(lostSaleIntent('0xa', NOW)).toBeUndefined();
  });

  it('opens a sale prompt in this page and across a reload, and the answer releases both once', () => {
    const release = openClaimedSale('scope', '0xabc');
    expect(isCctpSpendOpen('scope', '0xabc')).toBe(true);
    expect(lostSaleIntent('0xabc', Date.now())).toBeDefined();
    release();
    release();
    expect(isCctpSpendOpen('scope', '0xabc')).toBe(false);
    expect(lostSaleIntent('0xabc', Date.now())).toBeUndefined();
  });

  it('keeps nothing when storage refuses, as before', () => {
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => markSaleIntent('scope', '0xabc', NOW)).not.toThrow();
    setItem.mockRestore();
    expect(lostSaleIntent('0xabc', NOW)).toBeUndefined();
  });
});
