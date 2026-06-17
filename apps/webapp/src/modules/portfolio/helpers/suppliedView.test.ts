import { describe, expect, it } from 'vitest';
import { Intent } from '@/lib/enums';
import type { EarnProductRow, EarnUsdAmount } from '@/hooks';
import { resolveTokenColor } from '@/widgets/shared/constants';
import { buildSuppliedView } from './suppliedView';

const makeRow = (overrides: Partial<EarnProductRow> & Pick<EarnProductRow, 'id'>): EarnProductRow => ({
  kind: 'savings',
  intent: Intent.SAVINGS_INTENT,
  name: overrides.id,
  tokenSymbol: 'USDS',
  supplyTokens: ['USDS'],
  risk: 'moderate',
  networks: [1],
  detailPath: '/earn/savings',
  rate: { formatted: '0.00%' },
  isLoading: false,
  error: null,
  ...overrides
});

const amount = (totalUsd: number, byChain?: EarnUsdAmount['byChain']): EarnUsdAmount => ({
  totalUsd,
  ...(byChain ? { byChain } : {})
});

describe('buildSuppliedView', () => {
  const rows: EarnProductRow[] = [
    makeRow({
      id: 'savings',
      name: 'Sky Savings Rate',
      tokenSymbol: 'sUSDS',
      kind: 'savings',
      detailPath: '/earn/savings',
      rate: { value: 0.05, formatted: '5.00%' },
      position: amount(900, { 1: 600, 8453: 300 })
    }),
    makeRow({
      id: 'vault-usds',
      name: 'USDS Flagship',
      tokenSymbol: 'USDS',
      kind: 'vault',
      detailPath: '/earn/vaults/morpho/0xabc',
      rate: { value: 0.1, formatted: '10.00%' },
      position: amount(80, { 1: 80 })
    }),
    makeRow({
      id: 'stusds',
      name: 'stUSDS',
      tokenSymbol: 'stUSDS',
      kind: 'stusds',
      detailPath: '/earn/expert/stusds',
      rate: { value: 0.2, formatted: '20.00%' },
      position: amount(20, { 1: 20 })
    })
  ];

  it('totals and sorts positions by amount descending for "all" networks', () => {
    const view = buildSuppliedView(rows, 'all');
    expect(view.totalSupplied).toBe(1000);
    expect(view.activePositions).toBe(3);
    expect(view.positions.map(p => p.id)).toEqual(['savings', 'vault-usds', 'stusds']);
    expect(view.positions.map(p => p.amountUsd)).toEqual([900, 80, 20]);
    expect(view.positions.map(p => p.share)).toEqual([0.9, 0.08, 0.02]);
  });

  it('derives each segment color from its display token', () => {
    const view = buildSuppliedView(rows, 'all');
    expect(view.positions[0].color).toBe(resolveTokenColor('sUSDS'));
    expect(view.positions[2].color).toBe('#F17FBD'); // stUSDS pink
  });

  it('carries the registry detailPath onto each position', () => {
    const view = buildSuppliedView(rows, 'all');
    expect(view.positions.map(p => p.detailPath)).toEqual([
      '/earn/savings',
      '/earn/vaults/morpho/0xabc',
      '/earn/expert/stusds'
    ]);
  });

  it('lists a position’s balance-bearing chains for the "all" scope', () => {
    const view = buildSuppliedView(rows, 'all');
    expect(view.positions.find(p => p.id === 'savings')?.chainIds).toEqual([1, 8453]);
    expect(view.positions.find(p => p.id === 'vault-usds')?.chainIds).toEqual([1]);
  });

  it('scopes chainIds to the selected chain', () => {
    const base = buildSuppliedView(rows, 8453);
    expect(base.positions.map(p => p.chainIds)).toEqual([[8453]]);

    const ethereum = buildSuppliedView(rows, 1);
    expect(ethereum.positions.map(p => p.chainIds)).toEqual([[1], [1], [1]]);
  });

  it('computes projected earnings and supplied-weighted average rate', () => {
    const view = buildSuppliedView(rows, 'all');
    // 900*0.05 + 80*0.10 + 20*0.20 = 45 + 8 + 4 = 57
    expect(view.projected1Y).toBeCloseTo(57);
    expect(view.avgRate).toBeCloseTo(0.057);
  });

  it('treats rate-less products as 0% when projecting and averaging', () => {
    const view = buildSuppliedView(
      [
        makeRow({ id: 'a', rate: { value: 0.1, formatted: '10%' }, position: amount(100) }),
        makeRow({ id: 'b', rate: { formatted: '—' }, position: amount(100) })
      ],
      'all'
    );
    expect(view.projected1Y).toBeCloseTo(10);
    expect(view.avgRate).toBeCloseTo(0.05);
  });

  it('narrows amounts to the selected chain via byChain', () => {
    const ethereum = buildSuppliedView(rows, 1);
    expect(ethereum.totalSupplied).toBe(700); // 600 + 80 + 20
    expect(ethereum.activePositions).toBe(3);

    const base = buildSuppliedView(rows, 8453);
    expect(base.totalSupplied).toBe(300); // savings only
    expect(base.activePositions).toBe(1);
    expect(base.positions[0].id).toBe('savings');
  });

  it('lists every chain with a positive position, regardless of the selected scope', () => {
    expect(buildSuppliedView(rows, 8453).networksWithPositions).toEqual([1, 8453]);
  });

  it('dedupes the supplied-token cluster by symbol', () => {
    const view = buildSuppliedView(
      [
        makeRow({ id: 'v1', tokenSymbol: 'USDS', position: amount(100) }),
        makeRow({ id: 'v2', tokenSymbol: 'USDS', position: amount(50) }),
        makeRow({ id: 'savings', tokenSymbol: 'sUSDS', position: amount(25) })
      ],
      'all'
    );
    expect(view.suppliedTokens).toEqual(['USDS', 'sUSDS']);
  });

  it('excludes products with no/zero position (incl. disconnected)', () => {
    const view = buildSuppliedView(
      [
        makeRow({ id: 'connected', position: amount(100) }),
        makeRow({ id: 'zero', position: amount(0) }),
        makeRow({ id: 'disconnected', position: undefined })
      ],
      'all'
    );
    expect(view.positions.map(p => p.id)).toEqual(['connected']);
    expect(view.totalSupplied).toBe(100);
  });

  it('returns an empty view for no rows', () => {
    const view = buildSuppliedView([], 'all');
    expect(view).toEqual({
      positions: [],
      totalSupplied: 0,
      projected1Y: 0,
      avgRate: 0,
      activePositions: 0,
      suppliedTokens: [],
      networksWithPositions: []
    });
  });
});
