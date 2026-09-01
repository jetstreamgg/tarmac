import { describe, expect, it } from 'vitest';
import type { ModalGridCell } from '@/components/product/ModalGridCells';
import { buildVaultEntryRows, buildVaultReviewRows, type VaultModalGridRow } from './vaultModalRows';

const ENTRY_INPUT = {
  rate: '4.10%',
  boostedRate: true,
  network: 'Ethereum',
  assetSymbol: 'USDC',
  supplyBefore: '100,000.00',
  supplyAfter: '110,000.00',
  earningsBefore: '184.80',
  earningsAfter: '192.40',
  hasAmount: true,
  networkFee: '–'
} as const;

const REVIEW_INPUT = {
  amount: '10,000.00',
  assetSymbol: 'USDC',
  estEarnings: '192.40',
  product: 'USDC Risk Capital',
  rate: '4.10%',
  boostedRate: true,
  withdrawal: 'Anytime',
  network: 'Ethereum',
  networkFee: '–'
} as const;

const gridLabels = (rows: VaultModalGridRow[]) => rows.map(row => row.map(cell => cell.label));
const byLabel = (rows: VaultModalGridRow[]): Record<string, ModalGridCell> =>
  Object.fromEntries(rows.flat().map(cell => [cell.label, cell]));

describe('buildVaultEntryRows — Figma 859:38105 / 859:38297 vault entry grid', () => {
  it('produces exactly the Figma grid pairing, in order', () => {
    expect(gridLabels(buildVaultEntryRows(ENTRY_INPUT))).toEqual([
      ['Rate', 'Network'],
      ['Supply', 'Est. 1Y yield (at current rate)'],
      ['Network fee']
    ]);
  });

  it('marks Supply and Est. earnings as before→after deltas once an amount is entered', () => {
    const cells = byLabel(buildVaultEntryRows(ENTRY_INPUT));
    expect(cells['Supply']).toMatchObject({
      kind: 'delta',
      before: '100,000.00',
      after: '110,000.00',
      token: 'USDC'
    });
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({
      kind: 'delta',
      before: '184.80',
      after: '192.40',
      token: 'USDC'
    });
  });

  it('collapses the delta cells to their current value with no amount (Figma empty state)', () => {
    const cells = byLabel(buildVaultEntryRows({ ...ENTRY_INPUT, hasAmount: false }));
    expect(cells['Supply']).toMatchObject({ kind: 'single', value: '100,000.00' });
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({ kind: 'single', value: '184.80' });
  });

  it('accents the rate with the morpho stars only while boosted', () => {
    expect(byLabel(buildVaultEntryRows(ENTRY_INPUT))['Rate']).toMatchObject({
      kind: 'single',
      value: '4.10%',
      rateAccent: 'morpho'
    });
    expect(
      byLabel(buildVaultEntryRows({ ...ENTRY_INPUT, boostedRate: false }))['Rate'].rateAccent
    ).toBeUndefined();
  });

  it('threads the Network hint', () => {
    expect(byLabel(buildVaultEntryRows(ENTRY_INPUT))['Network']).toMatchObject({
      kind: 'single',
      value: 'Ethereum',
      network: true
    });
  });
});

describe('buildVaultReviewRows — Figma 859:38553 review supply / 859:38234 review withdrawal', () => {
  it('produces exactly the Figma grid pairing, in order', () => {
    expect(gridLabels(buildVaultReviewRows('supply', REVIEW_INPUT))).toEqual([
      ["You'll supply", 'Est. 1Y yield (at current rate)'],
      ['Product', 'Rate'],
      ['Withdrawal', 'Network'],
      ['Network fee']
    ]);
  });

  it("labels the amount cell per flow (You'll supply vs You'll receive)", () => {
    expect(gridLabels(buildVaultReviewRows('withdraw', REVIEW_INPUT))[0]).toEqual([
      "You'll receive",
      'Est. 1Y yield (at current rate)'
    ]);
    expect(byLabel(buildVaultReviewRows('withdraw', REVIEW_INPUT))["You'll receive"]).toMatchObject({
      kind: 'single',
      value: '10,000.00',
      token: 'USDC'
    });
  });

  it('threads the review presentation hints (trend + trailing asset icon, morpho ring, stars)', () => {
    const cells = byLabel(buildVaultReviewRows('supply', REVIEW_INPUT));
    expect(cells['Est. 1Y yield (at current rate)']).toMatchObject({
      kind: 'single',
      value: '192.40',
      trend: true,
      trailingToken: 'USDC'
    });
    expect(cells['Product']).toMatchObject({
      value: 'USDC Risk Capital',
      token: 'USDC',
      productIcon: 'morpho'
    });
    expect(cells['Rate']).toMatchObject({ value: '4.10%', rateAccent: 'morpho' });
    expect(cells['Withdrawal']).toMatchObject({ kind: 'single', value: 'Anytime' });
    expect(cells['Network']).toMatchObject({ value: 'Ethereum', network: true });
  });
});
