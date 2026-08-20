import { describe, expect, it } from 'vitest';
import {
  buildRewardsSupplyModalRows,
  buildRewardsSupplyReviewRows,
  buildRewardsWithdrawModalRows,
  buildRewardsWithdrawReviewRows,
  type RewardsModalCell,
  type RewardsModalGridRow
} from './rewardsModalRows';

const ENTRY_INPUT = {
  rate: '4.50%',
  network: 'Ethereum',
  supplyToken: 'USDS',
  supplyBefore: '100',
  supplyAfter: '110',
  hasAmount: true,
  earningsBefore: '$4.50',
  earningsAfter: '$4.95',
  networkFee: '–'
} as const;

const gridLabels = (rows: RewardsModalGridRow[]) => rows.map(row => row.map(cell => cell.label));
const flat = (rows: RewardsModalGridRow[]) => rows.flat();
const byLabel = (rows: RewardsModalGridRow[]): Record<string, RewardsModalCell> =>
  Object.fromEntries(flat(rows).map(cell => [cell.label, cell]));

describe('buildRewardsSupplyModalRows — "Supply to {farm}" entry grid (Savings shape, no own comp)', () => {
  it('produces exactly the adapted grid pairing, in order', () => {
    const rows = buildRewardsSupplyModalRows({ ...ENTRY_INPUT, rewardsIn: 'SPK' });
    expect(gridLabels(rows)).toEqual([
      ['Rate', 'Network'],
      ['Supply', 'Est. 1Y yield (at current rate)'],
      ['Rewards in', 'Network fee']
    ]);
  });

  it('marks Supply and Est. earnings as before→after deltas once an amount is entered', () => {
    const cells = byLabel(buildRewardsSupplyModalRows({ ...ENTRY_INPUT, rewardsIn: 'SPK' }));
    expect(cells['Supply']).toMatchObject({ kind: 'delta', before: '100', after: '110', token: 'USDS' });
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({
      kind: 'delta',
      before: '$4.50',
      after: '$4.95'
    });
  });

  it('collapses the delta cells to their current value with no amount', () => {
    const cells = byLabel(buildRewardsSupplyModalRows({ ...ENTRY_INPUT, hasAmount: false }));
    expect(cells['Supply']).toMatchObject({ kind: 'single', value: '100' });
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({ kind: 'single', value: '$4.50' });
  });

  it('threads the single-value cells with their presentation hints', () => {
    const cells = byLabel(buildRewardsSupplyModalRows({ ...ENTRY_INPUT, rewardsIn: 'SPK' }));
    expect(cells['Rate']).toMatchObject({ kind: 'single', value: '4.50%', rateAccent: 'savings' });
    expect(cells['Network']).toMatchObject({ kind: 'single', value: 'Ethereum', network: true });
    expect(cells['Rewards in']).toMatchObject({ kind: 'single', value: 'SPK', token: 'SPK' });
    expect(cells['Network fee']).toMatchObject({ kind: 'single', value: '–' });
  });

  it('drops the Rewards in cell for point farms (no reward token)', () => {
    expect(gridLabels(buildRewardsSupplyModalRows(ENTRY_INPUT))).toEqual([
      ['Rate', 'Network'],
      ['Supply', 'Est. 1Y yield (at current rate)'],
      ['Network fee']
    ]);
  });
});

describe('buildRewardsWithdrawModalRows — "Withdraw from {farm}" entry grid', () => {
  it('mirrors the supply grid pairing without the Rewards in cell', () => {
    expect(gridLabels(buildRewardsWithdrawModalRows({ ...ENTRY_INPUT, supplyAfter: '90' }))).toEqual([
      ['Rate', 'Network'],
      ['Supply', 'Est. 1Y yield (at current rate)'],
      ['Network fee']
    ]);
  });

  it('keeps Rate single (a withdrawal never moves the rate) and deltas the position', () => {
    const cells = byLabel(buildRewardsWithdrawModalRows({ ...ENTRY_INPUT, supplyAfter: '90' }));
    expect(cells['Rate']).toMatchObject({ kind: 'single', value: '4.50%', rateAccent: 'savings' });
    expect(cells['Supply']).toMatchObject({ kind: 'delta', before: '100', after: '90' });
  });
});

describe('buildRewardsSupplyReviewRows — "Review supply" grid', () => {
  const REVIEW_INPUT = {
    estEarnings: '$4.95',
    product: 'SPK Rewards',
    productToken: 'SPK',
    rate: '4.50%',
    withdrawal: 'Anytime',
    network: 'Ethereum',
    rewardsIn: 'SPK',
    networkFee: '–'
  } as const;

  it('produces exactly the adapted review pairing, in order', () => {
    expect(gridLabels(buildRewardsSupplyReviewRows(REVIEW_INPUT))).toEqual([
      ['Rewards in', 'Est. 1Y yield (at current rate)'],
      ['Product', 'Rate'],
      ['Withdrawal', 'Network'],
      ['Network fee']
    ]);
  });

  it('renders every review cell as a single value with its presentation hints', () => {
    const rows = buildRewardsSupplyReviewRows(REVIEW_INPUT);
    expect(flat(rows).every(cell => cell.kind === 'single')).toBe(true);

    const cells = byLabel(rows);
    expect(cells['Rewards in']).toMatchObject({ value: 'SPK', token: 'SPK' });
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({ value: '$4.95', trend: true });
    expect(cells['Product']).toMatchObject({ value: 'SPK Rewards', token: 'SPK', productIcon: 'default' });
    expect(cells['Rate']).toMatchObject({ value: '4.50%', rateAccent: 'savings' });
    expect(cells['Withdrawal']).toMatchObject({ value: 'Anytime' });
    expect(cells['Network']).toMatchObject({ value: 'Ethereum', network: true });
  });

  it('lets Est. earnings stand alone for point farms (no Rewards in cell)', () => {
    const rows = buildRewardsSupplyReviewRows({ ...REVIEW_INPUT, rewardsIn: undefined });
    expect(gridLabels(rows)).toEqual([
      ['Est. 1Y yield (at current rate)'],
      ['Product', 'Rate'],
      ['Withdrawal', 'Network'],
      ['Network fee']
    ]);
  });
});

describe('buildRewardsWithdrawReviewRows — "Review withdrawal" grid', () => {
  const REVIEW_INPUT = {
    youReceive: '908.93 USDS',
    receiveToken: 'USDS',
    estEarnings: '$4.05',
    product: 'SPK Rewards',
    productToken: 'SPK',
    rate: '4.50%',
    withdrawal: 'Instant',
    network: 'Ethereum',
    networkFee: '–'
  } as const;

  it('produces exactly the adapted withdraw review pairing, in order', () => {
    expect(gridLabels(buildRewardsWithdrawReviewRows(REVIEW_INPUT))).toEqual([
      ["You'll receive", 'Est. 1Y yield (at current rate)'],
      ['Product', 'Rate'],
      ['Withdrawal', 'Network'],
      ['Network fee']
    ]);
  });

  it('renders every review cell as a single value with its presentation hints', () => {
    const rows = buildRewardsWithdrawReviewRows(REVIEW_INPUT);
    expect(flat(rows).every(cell => cell.kind === 'single')).toBe(true);

    const cells = byLabel(rows);
    expect(cells["You'll receive"]).toMatchObject({ value: '908.93 USDS', token: 'USDS' });
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({ value: '$4.05', trend: true });
    expect(cells['Product']).toMatchObject({ value: 'SPK Rewards', token: 'SPK', productIcon: 'default' });
    expect(cells['Rate']).toMatchObject({ value: '4.50%', rateAccent: 'savings' });
    expect(cells['Withdrawal']).toMatchObject({ value: 'Instant' });
    expect(cells['Network']).toMatchObject({ value: 'Ethereum', network: true });
  });
});
