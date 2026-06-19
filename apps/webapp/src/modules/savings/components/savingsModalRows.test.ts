import { describe, expect, it } from 'vitest';
import {
  buildSupplyModalRows,
  buildSupplyReviewRows,
  buildWithdrawModalRows,
  type SavingsModalRow
} from './savingsModalRows';

const INPUT = {
  savingsRate: '6.50%',
  supplyBefore: '100 USDS',
  supplyAfter: '110 USDS',
  earningsBefore: '–',
  earningsAfter: '–',
  network: 'Ethereum',
  networkFee: '–'
} as const;

const WITHDRAW_INPUT = {
  savingsRateBefore: '6.50%',
  savingsRateAfter: '6.50%',
  supplyBefore: '100 USDS',
  supplyAfter: '90 USDS',
  earningsBefore: '–',
  earningsAfter: '–',
  network: 'Ethereum',
  networkFee: '–'
} as const;

const labels = (rows: SavingsModalRow[]) => rows.map(r => r.label);
const kinds = (rows: SavingsModalRow[]) => rows.map(r => r.kind);

describe('buildSupplyModalRows — Figma 527:7591 "Supply to Sky Savings"', () => {
  it('produces exactly the Figma supply row set, in order', () => {
    const rows = buildSupplyModalRows(INPUT);
    // Exact labels, exact order — this is the Figma contract for the supply modal.
    expect(labels(rows)).toEqual(['Savings rate', 'Supply', '1Y est. earnings', 'Network', 'Network fee']);
  });

  it('marks Supply and 1Y est. earnings as before→after deltas; the rest single', () => {
    const rows = buildSupplyModalRows(INPUT);
    expect(kinds(rows)).toEqual(['single', 'delta', 'delta', 'single', 'single']);
  });

  it('threads the single-value rows through verbatim', () => {
    const rows = buildSupplyModalRows(INPUT);
    const byLabel = Object.fromEntries(rows.map(r => [r.label, r]));

    expect(byLabel['Savings rate']).toMatchObject({ kind: 'single', value: '6.50%' });
    expect(byLabel['Network']).toMatchObject({ kind: 'single', value: 'Ethereum' });
    expect(byLabel['Network fee']).toMatchObject({ kind: 'single', value: '–' });
  });

  it('threads the before/after pair onto each delta row', () => {
    const rows = buildSupplyModalRows(INPUT);
    const byLabel = Object.fromEntries(rows.map(r => [r.label, r]));

    expect(byLabel['Supply']).toMatchObject({ kind: 'delta', before: '100 USDS', after: '110 USDS' });
    expect(byLabel['1Y est. earnings']).toMatchObject({ kind: 'delta', before: '–', after: '–' });
  });

  it('omits the L2 "Receive at least" row on mainnet (no minReceived)', () => {
    const rows = buildSupplyModalRows(INPUT);
    expect(labels(rows)).not.toContain('Receive at least');
  });

  it('appends a "Receive at least" single row after Supply when minReceived is given (L2 PSM)', () => {
    // L2 supply surfaces the sUSDS slippage floor; placement is right after Supply.
    const rows = buildSupplyModalRows({ ...INPUT, minReceived: '4.95 sUSDS' });
    expect(labels(rows)).toEqual([
      'Savings rate',
      'Supply',
      'Receive at least',
      '1Y est. earnings',
      'Network',
      'Network fee'
    ]);
    const byLabel = Object.fromEntries(rows.map(r => [r.label, r]));
    expect(byLabel['Receive at least']).toMatchObject({ kind: 'single', value: '4.95 sUSDS' });
  });
});

describe('buildWithdrawModalRows — Figma 527:10945 "Withdraw from Sky Savings"', () => {
  it('produces exactly the Figma withdraw row set, in order', () => {
    const rows = buildWithdrawModalRows(WITHDRAW_INPUT);
    // Exact labels, exact order — this is the Figma contract for the withdraw modal.
    expect(labels(rows)).toEqual(['Savings rate', 'Supply', '1Y est. earnings', 'Network', 'Network fee']);
  });

  it('marks Savings rate, Supply and 1Y est. earnings as before→after deltas; the rest single', () => {
    const rows = buildWithdrawModalRows(WITHDRAW_INPUT);
    // Unlike supply, "Savings rate" is a delta here (Figma 527:10945).
    expect(kinds(rows)).toEqual(['delta', 'delta', 'delta', 'single', 'single']);
  });

  it('threads the single-value rows through verbatim', () => {
    const rows = buildWithdrawModalRows(WITHDRAW_INPUT);
    const byLabel = Object.fromEntries(rows.map(r => [r.label, r]));

    expect(byLabel['Network']).toMatchObject({ kind: 'single', value: 'Ethereum' });
    expect(byLabel['Network fee']).toMatchObject({ kind: 'single', value: '–' });
  });

  it('threads the before/after pair onto each delta row', () => {
    const rows = buildWithdrawModalRows(WITHDRAW_INPUT);
    const byLabel = Object.fromEntries(rows.map(r => [r.label, r]));

    expect(byLabel['Savings rate']).toMatchObject({ kind: 'delta', before: '6.50%', after: '6.50%' });
    expect(byLabel['Supply']).toMatchObject({ kind: 'delta', before: '100 USDS', after: '90 USDS' });
    expect(byLabel['1Y est. earnings']).toMatchObject({ kind: 'delta', before: '–', after: '–' });
  });
});

describe('buildSupplyReviewRows — Figma 527:7812 "Review supply"', () => {
  const REVIEW_INPUT = {
    youReceive: '908.93 sUSDS',
    apy: '3.60%',
    estEarnings: '–',
    product: 'Sky Savings',
    withdrawal: 'Anytime',
    network: 'Ethereum',
    networkFee: '–'
  } as const;

  it('produces exactly the Figma review row set, in order (You supply is the header)', () => {
    const rows = buildSupplyReviewRows(REVIEW_INPUT);
    expect(labels(rows)).toEqual([
      "You'll receive",
      'APY',
      'Est. earnings (1Y)',
      'Product',
      'Withdrawal',
      'Network',
      'Network fee'
    ]);
  });

  it('renders every review row as a single value', () => {
    const rows = buildSupplyReviewRows(REVIEW_INPUT);
    expect(kinds(rows)).toEqual(Array(7).fill('single'));
  });

  it('threads the values through verbatim', () => {
    const rows = buildSupplyReviewRows(REVIEW_INPUT);
    const byLabel = Object.fromEntries(rows.map(r => [r.label, r]));

    expect(byLabel["You'll receive"]).toMatchObject({ kind: 'single', value: '908.93 sUSDS' });
    expect(byLabel['APY']).toMatchObject({ kind: 'single', value: '3.60%' });
    expect(byLabel['Product']).toMatchObject({ kind: 'single', value: 'Sky Savings' });
    expect(byLabel['Withdrawal']).toMatchObject({ kind: 'single', value: 'Anytime' });
  });
});
