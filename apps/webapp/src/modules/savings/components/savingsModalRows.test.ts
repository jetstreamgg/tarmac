import { describe, expect, it } from 'vitest';
import {
  buildSupplyModalRows,
  buildSupplyReviewRows,
  buildWithdrawModalRows,
  buildWithdrawReviewRows,
  type SavingsModalCell,
  type SavingsModalGridRow
} from './savingsModalRows';

const INPUT = {
  savingsRate: '6.50%',
  network: 'Ethereum',
  supplyBefore: '100',
  supplyAfter: '110',
  hasAmount: true,
  earningsBefore: '6.5',
  earningsAfter: '7.15',
  networkFee: '–'
} as const;

const WITHDRAW_INPUT = {
  savingsRate: '6.50%',
  network: 'Ethereum',
  supplyBefore: '100',
  supplyAfter: '90',
  hasAmount: true,
  earningsBefore: '6.5',
  earningsAfter: '5.85',
  networkFee: '–'
} as const;

const gridLabels = (rows: SavingsModalGridRow[]) => rows.map(row => row.map(cell => cell.label));
const flat = (rows: SavingsModalGridRow[]) => rows.flat();
const byLabel = (rows: SavingsModalGridRow[]): Record<string, SavingsModalCell> =>
  Object.fromEntries(flat(rows).map(cell => [cell.label, cell]));

// The Network cell becomes a switch dropdown on a multi-chain flow's ENTRY
// screen and stays a plain value on the review, whose numbers were all built
// for one chain — switching underneath them would leave the grid describing a
// transaction that is no longer the one on offer.
describe('the Network cell: a control on entry, a value on review', () => {
  const CHAINS = [1, 8453];

  it('carries the switchable chains on both entry grids', () => {
    for (const rows of [
      buildSupplyModalRows({ ...INPUT, networkChainIds: CHAINS }),
      buildWithdrawModalRows({ ...WITHDRAW_INPUT, networkChainIds: CHAINS })
    ]) {
      expect(byLabel(rows)['Network'].networkChainIds).toEqual(CHAINS);
    }
  });

  it('leaves them off when the flow names none (every mainnet-only product)', () => {
    expect(byLabel(buildSupplyModalRows(INPUT))['Network'].networkChainIds).toBeUndefined();
  });

  it('never carries them on a review grid — the builders take no such input', () => {
    const review = {
      youReceive: '908.93 sUSDS',
      estEarnings: '59.09',
      product: 'Sky Savings',
      rate: '3.60%',
      withdrawal: 'Anytime',
      network: 'Ethereum',
      networkFee: '–'
    } as const;
    expect(byLabel(buildSupplyReviewRows(review))['Network'].networkChainIds).toBeUndefined();
    expect(
      byLabel(buildWithdrawReviewRows({ ...review, receiveToken: 'USDS' }))['Network'].networkChainIds
    ).toBeUndefined();
  });
});

describe('buildSupplyModalRows — Figma 859:36036 "Supply to Sky Savings" entry grid', () => {
  it('produces exactly the Figma grid pairing, in order', () => {
    const rows = buildSupplyModalRows(INPUT);
    // Exact labels, exact pairing — this is the Figma contract for the entry grid.
    expect(gridLabels(rows)).toEqual([
      ['Savings rate', 'Network'],
      ['Supply', 'Est. 1Y yield (at current rate)'],
      ['Network fee']
    ]);
  });

  it('marks Supply and Est. earnings as before→after deltas once an amount is entered', () => {
    const cells = byLabel(buildSupplyModalRows(INPUT));
    expect(cells['Supply']).toMatchObject({ kind: 'delta', before: '100', after: '110' });
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({
      kind: 'delta',
      before: '6.5',
      after: '7.15'
    });
  });

  it('collapses the delta cells to their current value with no amount (Figma 859:36036 empty state)', () => {
    const cells = byLabel(buildSupplyModalRows({ ...INPUT, hasAmount: false }));
    expect(cells['Supply']).toMatchObject({ kind: 'single', value: '100' });
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({ kind: 'single', value: '6.5' });
  });

  it('threads the single-value cells with their presentation hints', () => {
    const cells = byLabel(buildSupplyModalRows(INPUT));
    expect(cells['Savings rate']).toMatchObject({ kind: 'single', value: '6.50%', rateAccent: 'savings' });
    expect(cells['Network']).toMatchObject({ kind: 'single', value: 'Ethereum', network: true });
    expect(cells['Network fee']).toMatchObject({ kind: 'single', value: '–' });
    expect(cells['Supply']).toMatchObject({ token: 'USDS' });
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({ token: 'USDS' });
  });

  it('omits the L2 "Receive at least" cell on mainnet (no minReceived)', () => {
    expect(flat(buildSupplyModalRows(INPUT)).map(c => c.label)).not.toContain('Receive at least');
  });

  it('pairs "Receive at least" with Network fee when minReceived is given (L2 PSM)', () => {
    const rows = buildSupplyModalRows({ ...INPUT, minReceived: '4.95' });
    expect(gridLabels(rows)).toEqual([
      ['Savings rate', 'Network'],
      ['Supply', 'Est. 1Y yield (at current rate)'],
      ['Receive at least', 'Network fee']
    ]);
    expect(byLabel(rows)['Receive at least']).toMatchObject({
      kind: 'single',
      value: '4.95',
      token: 'sUSDS'
    });
  });
});

describe('buildWithdrawModalRows — "Withdraw from Sky Savings" entry grid', () => {
  it('mirrors the supply grid pairing', () => {
    expect(gridLabels(buildWithdrawModalRows(WITHDRAW_INPUT))).toEqual([
      ['Savings rate', 'Network'],
      ['Supply', 'Est. 1Y yield (at current rate)'],
      ['Network fee']
    ]);
  });

  it('keeps Savings rate single (a withdrawal never moves the rate) and deltas the position', () => {
    const cells = byLabel(buildWithdrawModalRows(WITHDRAW_INPUT));
    expect(cells['Savings rate']).toMatchObject({ kind: 'single', value: '6.50%', rateAccent: 'savings' });
    expect(cells['Supply']).toMatchObject({ kind: 'delta', before: '100', after: '90' });
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({
      kind: 'delta',
      before: '6.5',
      after: '5.85'
    });
  });
});

describe('buildSupplyReviewRows — Figma 859:36154 "Review supply" grid', () => {
  const REVIEW_INPUT = {
    youReceive: '908.93 sUSDS',
    estEarnings: '59.09',
    product: 'Sky Savings',
    rate: '3.60%',
    withdrawal: 'Anytime',
    network: 'Ethereum',
    networkFee: '–'
  } as const;

  it('produces exactly the Figma review grid pairing, in order', () => {
    expect(gridLabels(buildSupplyReviewRows(REVIEW_INPUT))).toEqual([
      ["You'll receive", 'Est. 1Y yield (at current rate)'],
      ['Product', 'Rate'],
      ['Withdrawal', 'Network'],
      ['Network fee']
    ]);
  });

  it('renders every review cell as a single value with its presentation hints', () => {
    const rows = buildSupplyReviewRows(REVIEW_INPUT);
    expect(flat(rows).every(cell => cell.kind === 'single')).toBe(true);

    const cells = byLabel(rows);
    expect(cells["You'll receive"]).toMatchObject({ value: '908.93 sUSDS', token: 'sUSDS' });
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({
      value: '59.09',
      trend: true,
      trailingToken: 'USDS'
    });
    expect(cells['Product']).toMatchObject({ value: 'Sky Savings', token: 'sUSDS', productIcon: 'default' });
    expect(cells['Rate']).toMatchObject({ value: '3.60%', rateAccent: 'savings' });
    expect(cells['Withdrawal']).toMatchObject({ value: 'Anytime' });
    expect(cells['Network']).toMatchObject({ value: 'Ethereum', network: true });
  });
});

describe('buildWithdrawReviewRows — Figma 859:36322 "Review withdrawal" grid', () => {
  const REVIEW_INPUT = {
    youReceive: '908.93 USDS',
    receiveToken: 'USDS',
    estEarnings: '3.28',
    product: 'Sky Savings',
    rate: '3.60%',
    withdrawal: 'Instant',
    network: 'Ethereum',
    networkFee: '–'
  } as const;

  it('produces exactly the Figma withdraw review pairing, in order', () => {
    expect(gridLabels(buildWithdrawReviewRows(REVIEW_INPUT))).toEqual([
      ["You'll receive", 'Est. 1Y yield (at current rate)'],
      ['Product', 'Rate'],
      ['Withdrawal', 'Network'],
      ['Network fee']
    ]);
  });

  it('renders every review cell as a single value with its presentation hints', () => {
    const rows = buildWithdrawReviewRows(REVIEW_INPUT);
    expect(flat(rows).every(cell => cell.kind === 'single')).toBe(true);

    const cells = byLabel(rows);
    expect(cells["You'll receive"]).toMatchObject({ value: '908.93 USDS', token: 'USDS' });
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({
      value: '3.28',
      trend: true,
      trailingToken: 'USDS'
    });
    expect(cells['Product']).toMatchObject({ value: 'Sky Savings', token: 'sUSDS', productIcon: 'default' });
    expect(cells['Rate']).toMatchObject({ value: '3.60%', rateAccent: 'savings' });
    expect(cells['Withdrawal']).toMatchObject({ value: 'Instant' });
    expect(cells['Network']).toMatchObject({ value: 'Ethereum', network: true });
  });
});
