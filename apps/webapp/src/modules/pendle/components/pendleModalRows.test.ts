import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  buildPendleReviewRows,
  buildPendleSupplyEntryRows,
  buildPendleWithdrawEntryRows,
  type PendleReviewRowInput
} from './pendleModalRows';

const supplyEntryInput = {
  rate: '4.20%',
  claimDate: '18 Jun 2026',
  displaySymbol: 'USDS',
  claimAtMaturity: '10,228.22',
  estEarnings: '228.22',
  daysToMaturity: 49,
  network: 'Ethereum',
  networkFee: '–'
};

describe('buildPendleSupplyEntryRows', () => {
  it('pairs the cells per the Figma supply entry grid (2193:73513)', () => {
    const rows = buildPendleSupplyEntryRows(supplyEntryInput);
    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Fixed rate', 'Claim date'],
      ['Claim at maturity', 'Est. 49D yield'],
      ['Network', 'Network fee']
    ]);
    expect(rows[0][0]).toMatchObject({ kind: 'single', value: '4.20%', rateAccent: 'savings' });
    expect(rows[1][0]).toMatchObject({ value: '10,228.22', token: 'USDS' });
    expect(rows[1][1]).toMatchObject({ value: '228.22', token: 'USDS' });
  });

  it('pins the Network cell to the engine chain when one is given', () => {
    const rows = buildPendleSupplyEntryRows({ ...supplyEntryInput, networkChainId: 1 });
    expect(rows[2][0]).toMatchObject({ label: 'Network', network: true, networkChainId: 1 });
  });

  it('bakes the days-to-maturity into the earnings label', () => {
    const rows = buildPendleSupplyEntryRows({ ...supplyEntryInput, daysToMaturity: 7 });
    expect(rows[1][1].label).toBe('Est. 7D yield');
  });
});

const withdrawEntryInput = {
  tokenSelector: { marker: 'selector' } as unknown as ReactNode,
  receiveAmount: '100,000.80',
  receiveSymbol: 'USDS',
  lost: '184.00',
  lostTrend: true,
  displaySymbol: 'USDS',
  network: 'Ethereum',
  networkFee: '–'
};

describe('buildPendleWithdrawEntryRows', () => {
  it('pairs the cells per the Figma "Early withdrawal" entry grid (2193:73598)', () => {
    const rows = buildPendleWithdrawEntryRows(withdrawEntryInput);
    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Withdrawal token', "You'll receive"],
      ['Lost on early withdrawal', 'Network'],
      ['Network fee']
    ]);
    expect(rows[0][1]).toMatchObject({ kind: 'single', value: '100,000.80', token: 'USDS' });
  });

  it('passes the token selector through opaquely as a node cell', () => {
    const rows = buildPendleWithdrawEntryRows(withdrawEntryInput);
    expect(rows[0][0]).toMatchObject({ kind: 'node' });
    expect((rows[0][0] as { node: unknown }).node).toBe(withdrawEntryInput.tokenSelector);
  });

  it('draws the lost cell with the red down-trend and the trailing token icon', () => {
    const info = { marker: 'info' } as unknown as ReactNode;
    const rows = buildPendleWithdrawEntryRows({ ...withdrawEntryInput, lostInfo: info });
    const lost = rows[1][0];
    expect(lost).toMatchObject({ kind: 'single', value: '184.00', trend: 'down', trailingToken: 'USDS' });
    expect(lost.labelAction).toBe(info);
  });

  it('drops the down-trend when nothing is forfeited — a favorable quote is not a loss', () => {
    const rows = buildPendleWithdrawEntryRows({ ...withdrawEntryInput, lost: '0', lostTrend: false });
    expect(rows[1][0].trend).toBeUndefined();
  });
});

const reviewInput: PendleReviewRowInput = {
  displaySymbol: 'USDS',
  claimAtMaturity: '10,228.22',
  claimDate: '18 Jun 2026',
  estEarnings: '228.22',
  daysToMaturity: 49,
  rate: '4.20%',
  withdrawalAmount: '100,184.80',
  ptSymbol: 'PT-sUSDS',
  receiveSymbol: 'USDC',
  minReceived: '99,500.30',
  product: 'Pendle sUSDS (PT-sUSDS)',
  productSymbol: 'sUSDS',
  withdrawal: 'At maturity or via market sell',
  slippage: '0.50%',
  slippageMode: 'Auto',
  priceImpact: '0.02%',
  network: 'Ethereum',
  networkFee: '–'
};

describe('buildPendleReviewRows', () => {
  it('pairs the supply review cells per Figma 2193:73734, with min-received and price-impact kept', () => {
    const rows = buildPendleReviewRows('supply', reviewInput);
    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Fixed rate', 'Claim date'],
      ['Claim at maturity', 'Est. 49D yield'],
      ['Product', 'Withdrawal'],
      ['Slippage', 'Price impact'],
      ['Min. received', 'Network'],
      ['Network fee']
    ]);
    expect(rows[0][0]).toMatchObject({ value: '4.20%', rateAccent: 'savings' });
    expect(rows[1][0]).toMatchObject({ value: '10,228.22', token: 'USDS' });
    expect(rows[2][0]).toMatchObject({ value: 'Pendle sUSDS (PT-sUSDS)', productIcon: 'pendle' });
    expect(rows[2][1]).toMatchObject({ value: 'At maturity or via market sell' });
    expect(rows[4][0]).toMatchObject({ value: '99,500.30', token: 'PT-sUSDS' });
  });

  it('pairs the withdraw review cells per Figma 2193:73807, with min-received and price-impact slotted in', () => {
    const rows = buildPendleReviewRows('withdraw', reviewInput);
    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Product', 'Withdrawal amount'],
      ['Slippage', 'Min. received'],
      ['Price impact', 'Network'],
      ['Network fee']
    ]);
    expect(rows[0][1]).toMatchObject({ value: '100,184.80', token: 'PT-sUSDS' });
    expect(rows[1][1]).toMatchObject({ value: '99,500.30', token: 'USDC' });
    expect(rows[2][0]).toMatchObject({ kind: 'single', value: '0.02%' });
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
