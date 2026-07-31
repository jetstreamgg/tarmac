import { describe, expect, it } from 'vitest';
import { buildPendleEntryRows, buildPendleReviewRows, type PendleReviewRowInput } from './pendleModalRows';

const entryInput = {
  rateBefore: '4.20%',
  rateAfter: '3.97%',
  network: 'Ethereum',
  displaySymbol: 'USDS',
  supplyBefore: '100,000.00',
  supplyAfter: '110,000.00',
  earningsBefore: '184.80',
  earningsAfter: '228.22',
  claimBefore: '100,184.80',
  claimAfter: '110,228.22',
  daysToMaturity: 49,
  claimDate: '18 Jun 2026',
  hasAmount: true,
  networkFee: '–'
};

describe('buildPendleEntryRows', () => {
  it('pairs the cells per the Figma entry grid (859:41388)', () => {
    const rows = buildPendleEntryRows(entryInput);
    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Fixed rate', 'Network'],
      ['Supply', 'Est. earnings (49D)'],
      ["You'll claim", 'Claim date'],
      ['Network fee']
    ]);
  });

  it('draws deltas with the amount entered, including the green-accented rate', () => {
    const rows = buildPendleEntryRows(entryInput);
    expect(rows[0][0]).toMatchObject({
      kind: 'delta',
      before: '4.20%',
      after: '3.97%',
      rateAccent: 'savings'
    });
    expect(rows[1][0]).toMatchObject({ kind: 'delta', token: 'USDS', before: '100,000.00' });
    expect(rows[2][0]).toMatchObject({ kind: 'delta', before: '100,184.80', after: '110,228.22' });
  });

  it('collapses to single values without an amount', () => {
    const rows = buildPendleEntryRows({ ...entryInput, hasAmount: false });
    expect(rows[0][0]).toMatchObject({ kind: 'single', value: '4.20%' });
    expect(rows[1][1]).toMatchObject({ kind: 'single', value: '184.80', token: 'USDS' });
    expect(rows[2][0]).toMatchObject({ kind: 'single', value: '100,184.80' });
  });

  it('bakes the days-to-maturity into the earnings label', () => {
    const rows = buildPendleEntryRows({ ...entryInput, daysToMaturity: 7 });
    expect(rows[1][1].label).toBe('Est. earnings (7D)');
  });
});

const reviewInput: PendleReviewRowInput = {
  displaySymbol: 'USDS',
  claimAfter: '110,228.22',
  claimDate: '18 Jun 2026',
  earningsAfter: '228.22',
  daysToMaturity: 49,
  receiveAmount: '10,000.00',
  receiveSymbol: 'USDC',
  rate: '3.97%',
  product: 'Pendle sUSDS (PT-sUSDS)',
  productSymbol: 'sUSDS',
  withdrawal: 'Anytime',
  slippage: '0.50%',
  slippageMode: 'Auto',
  priceImpact: '0.02%',
  network: 'Ethereum',
  networkFee: '–'
};

describe('buildPendleReviewRows', () => {
  it('pairs the supply review cells per Figma 859:41264, with the price-impact cell restored', () => {
    const rows = buildPendleReviewRows('supply', reviewInput);
    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Total at maturity', 'Claim date'],
      ['Total earnings', 'Fixed rate'],
      ['Product', 'Withdrawal'],
      ['Slippage', 'Price impact'],
      ['Network', 'Network fee']
    ]);
    expect(rows[0][0]).toMatchObject({ value: '110,228.22', token: 'USDS' });
    expect(rows[1][0]).toMatchObject({ trend: true, trailingToken: 'USDS' });
    expect(rows[1][1]).toMatchObject({ value: '3.97%', rateAccent: 'savings' });
    expect(rows[2][0]).toMatchObject({ value: 'Pendle sUSDS (PT-sUSDS)', productIcon: 'pendle' });
    expect(rows[3][1]).toMatchObject({ kind: 'single', value: '0.02%' });
  });

  it('pairs the withdraw review cells per Figma 859:41679 with the slippage and price-impact cells slotted in', () => {
    const rows = buildPendleReviewRows('withdraw', { ...reviewInput, withdrawal: 'Instant' });
    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ["You'll receive", 'Est. earnings (49D)'],
      ['Product', 'Fixed rate'],
      ['Withdrawal', 'Slippage'],
      ['Price impact', 'Network'],
      ['Network fee']
    ]);
    expect(rows[0][0]).toMatchObject({ value: '10,000.00', token: 'USDC' });
    expect(rows[2][0]).toMatchObject({ value: 'Instant' });
    expect(rows[3][0]).toMatchObject({ kind: 'single', value: '0.02%' });
  });

  it('carries the slippage mode badge and passes the action through opaquely', () => {
    const action = { marker: true };
    const rows = buildPendleReviewRows('supply', {
      ...reviewInput,
      slippageMode: 'Custom',
      slippageAction: action as unknown as PendleReviewRowInput['slippageAction']
    });
    const slippage = rows[3][0];
    expect(slippage).toMatchObject({ labelBadge: 'Custom', value: '0.50%' });
    expect(slippage.action).toBe(action);
  });
});
