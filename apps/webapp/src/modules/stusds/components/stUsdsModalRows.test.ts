import { describe, expect, it } from 'vitest';
import { buildStUsdsEntryRows, buildStUsdsReviewRows, type StUsdsModalGridRow } from './stUsdsModalRows';
import type { ModalGridCell } from '@/components/product/ModalGridCells';

const ENTRY_INPUT = {
  rate: '6.50%',
  network: 'Ethereum',
  supplyBefore: '100.00',
  supplyAfter: '110.00',
  earningsBefore: '6.50',
  earningsAfter: '7.15',
  hasAmount: true,
  networkFee: '–'
} as const;

const REVIEW_INPUT = {
  amount: '10.00',
  receive: '9.98',
  estEarnings: '7.15',
  rate: '6.50%',
  route: 'Native',
  routeDetail: 'stUSDS module',
  withdrawal: 'Anytime',
  network: 'Ethereum',
  networkFee: '–'
} as const;

const gridLabels = (rows: StUsdsModalGridRow[]) => rows.map(row => row.map(cell => cell.label));
const byLabel = (rows: StUsdsModalGridRow[]): Record<string, ModalGridCell> =>
  Object.fromEntries(rows.flat().map(cell => [cell.label, cell]));

describe('buildStUsdsEntryRows — vault-template entry grid', () => {
  it('produces the vault entry pairing, in order', () => {
    expect(gridLabels(buildStUsdsEntryRows(ENTRY_INPUT))).toEqual([
      ['Rate', 'Network'],
      ['Supply', 'Est. 1Y yield (at current rate)'],
      ['Network fee']
    ]);
  });

  it('keeps the Rate cell plain — stUSDS has no incentive accent', () => {
    const cells = byLabel(buildStUsdsEntryRows(ENTRY_INPUT));
    expect(cells['Rate']).toMatchObject({ kind: 'single', value: '6.50%' });
    expect(cells['Rate'].rateAccent).toBeUndefined();
  });

  it('marks Supply and Est. earnings as USDS before→after deltas once an amount is entered', () => {
    const cells = byLabel(buildStUsdsEntryRows(ENTRY_INPUT));
    expect(cells['Supply']).toMatchObject({
      kind: 'delta',
      before: '100.00',
      after: '110.00',
      token: 'USDS'
    });
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({
      kind: 'delta',
      before: '6.50',
      after: '7.15',
      token: 'USDS'
    });
  });

  it('collapses the delta cells to their current value with no amount', () => {
    const cells = byLabel(buildStUsdsEntryRows({ ...ENTRY_INPUT, hasAmount: false }));
    expect(cells['Supply']).toMatchObject({ kind: 'single', value: '100.00' });
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({ kind: 'single', value: '6.50' });
  });

  it('threads the Network and Network fee hints', () => {
    const cells = byLabel(buildStUsdsEntryRows(ENTRY_INPUT));
    expect(cells['Network']).toMatchObject({ kind: 'single', value: 'Ethereum', network: true });
    expect(cells['Network fee']).toMatchObject({ kind: 'single', value: '–' });
  });
});

describe('buildStUsdsReviewRows — vault-template review grids', () => {
  it('supply pairs the entered amount with the stUSDS receive quote (replacing Est. earnings)', () => {
    const rows = buildStUsdsReviewRows('supply', REVIEW_INPUT);
    expect(gridLabels(rows)).toEqual([
      ["You'll supply", "You'll receive"],
      ['Product', 'Rate'],
      ['Withdrawal', 'Network'],
      ['Route', 'Network fee']
    ]);
    const cells = byLabel(rows);
    expect(cells["You'll supply"]).toMatchObject({ kind: 'single', value: '10.00', token: 'USDS' });
    expect(cells["You'll receive"]).toMatchObject({ kind: 'single', value: '9.98', token: 'stUSDS' });
  });

  it('withdraw keeps the vault shape: receive in USDS beside Est. earnings', () => {
    // On withdraw the form passes the entered USDS amount as the receive value.
    const rows = buildStUsdsReviewRows('withdraw', {
      ...REVIEW_INPUT,
      receive: '10.00',
      withdrawal: 'Instant'
    });
    expect(gridLabels(rows)).toEqual([
      ["You'll receive", 'Est. 1Y yield (at current rate)'],
      ['Product', 'Rate'],
      ['Withdrawal', 'Network'],
      ['Route', 'Network fee']
    ]);
    const cells = byLabel(rows);
    expect(cells["You'll receive"]).toMatchObject({ kind: 'single', value: '10.00', token: 'USDS' });
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({
      kind: 'single',
      value: '7.15',
      trend: true,
      trailingToken: 'USDS'
    });
    expect(cells['Withdrawal']).toMatchObject({ kind: 'single', value: 'Instant' });
  });

  it('draws Product in the neutral default ring and keeps Rate plain', () => {
    const cells = byLabel(buildStUsdsReviewRows('supply', REVIEW_INPUT));
    expect(cells['Product']).toMatchObject({
      kind: 'single',
      value: 'stUSDS',
      token: 'stUSDS',
      productIcon: 'default'
    });
    expect(cells['Rate']).toMatchObject({ kind: 'single', value: '6.50%' });
    expect(cells['Rate'].rateAccent).toBeUndefined();
  });

  it('carries the route as a badge on the Route cell (Pendle Auto/Custom precedent)', () => {
    const native = byLabel(buildStUsdsReviewRows('supply', REVIEW_INPUT));
    expect(native['Route']).toMatchObject({
      kind: 'single',
      label: 'Route',
      labelBadge: 'Native',
      value: 'stUSDS module'
    });

    const curve = byLabel(
      buildStUsdsReviewRows('withdraw', { ...REVIEW_INPUT, route: 'Curve', routeDetail: 'Curve pool' })
    );
    expect(curve['Route']).toMatchObject({ labelBadge: 'Curve', value: 'Curve pool' });
  });
});
