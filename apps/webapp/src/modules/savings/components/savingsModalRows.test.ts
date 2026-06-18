import { describe, expect, it } from 'vitest';
import { buildSupplyModalRows, type SavingsModalRow } from './savingsModalRows';

const INPUT = {
  savingsRate: '6.50%',
  supplyBefore: '100 USDS',
  supplyAfter: '110 USDS',
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
});
