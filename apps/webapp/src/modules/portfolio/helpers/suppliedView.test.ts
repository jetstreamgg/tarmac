import { describe, expect, it } from 'vitest';
import { Intent } from '@/lib/enums';
import type { EarnProductRow, EarnUsdAmount } from '@/hooks';
import { buildSuppliedView } from './suppliedView';

const makeRow = (overrides: Partial<EarnProductRow> & Pick<EarnProductRow, 'id'>): EarnProductRow => ({
  kind: 'savings',
  intent: Intent.SAVINGS_INTENT,
  name: overrides.id,
  tokenSymbol: 'USDS',
  supplyTokens: ['USDS'],
  risk: 'moderate',
  riskProfile: 'savings',
  networks: [1],
  detailPath: '/earn/savings',
  rate: { formatted: '0.00%' },
  rate30d: { formatted: '—' },
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

  it('breaks a product down into one position per chain, sorted by amount descending', () => {
    const view = buildSuppliedView(rows);
    expect(view.totalSupplied).toBe(1000);
    expect(view.activePositions).toBe(4);
    expect(view.positions.map(p => p.id)).toEqual(['savings:1', 'savings:8453', 'vault-usds:1', 'stusds:1']);
    expect(view.positions.map(p => p.rowId)).toEqual(['savings', 'savings', 'vault-usds', 'stusds']);
    expect(view.positions.map(p => p.chainId)).toEqual([1, 8453, 1, 1]);
    expect(view.positions.map(p => p.amountUsd)).toEqual([600, 300, 80, 20]);
    expect(view.positions.map(p => p.share)).toEqual([0.6, 0.3, 0.08, 0.02]);
  });

  it('falls back to the product’s first network for a row carrying only a total', () => {
    const view = buildSuppliedView([makeRow({ id: 'savings', networks: [8453, 1], position: amount(100) })]);
    expect(view.positions).toHaveLength(1);
    expect(view.positions[0]).toMatchObject({
      id: 'savings:8453',
      rowId: 'savings',
      chainId: 8453,
      amountUsd: 100
    });
  });

  it('derives each segment color from its display token', () => {
    const view = buildSuppliedView(rows);
    expect(view.positions[0].color).toBe('#47b2a0');
    expect(view.positions[3].color).toBe('#deb3b5'); // DS Components/Charts/bg-stUSDS (APP-416)
  });

  it('carries the owning module intent onto each position', () => {
    const view = buildSuppliedView([
      makeRow({ id: 'savings', position: amount(100) }),
      makeRow({ id: 'vault-usds', kind: 'vault', intent: Intent.VAULTS_INTENT, position: amount(50) })
    ]);
    expect(view.positions.find(p => p.rowId === 'savings')?.intent).toBe(Intent.SAVINGS_INTENT);
    expect(view.positions.find(p => p.rowId === 'vault-usds')?.intent).toBe(Intent.VAULTS_INTENT);
  });

  it('carries the registry detailPath onto each position', () => {
    const view = buildSuppliedView(rows);
    expect(view.positions.map(p => p.detailPath)).toEqual([
      '/earn/savings',
      '/earn/savings',
      '/earn/vaults/morpho/0xabc',
      '/earn/expert/stusds'
    ]);
  });

  it('flags multi-chain products so the legend can mark their legs', () => {
    const view = buildSuppliedView([
      makeRow({ id: 'savings', networks: [1, 8453], position: amount(100, { 1: 100 }) }),
      makeRow({ id: 'vault-usds', kind: 'vault', networks: [1], position: amount(50, { 1: 50 }) })
    ]);
    expect(view.positions.map(p => [p.rowId, p.multichain])).toEqual([
      ['savings', true],
      ['vault-usds', false]
    ]);
  });

  it('skips a chain the product holds nothing on', () => {
    const view = buildSuppliedView([makeRow({ id: 'savings', position: amount(50, { 1: 50, 8453: 0 }) })]);
    expect(view.positions.map(p => p.chainId)).toEqual([1]);
  });

  it('computes projected earnings and supplied-weighted average rate', () => {
    const view = buildSuppliedView(rows);
    // 900*0.05 + 80*0.10 + 20*0.20 = 45 + 8 + 4 = 57
    expect(view.projected1Y).toBeCloseTo(57);
    expect(view.avgRate).toBeCloseTo(0.057);
  });

  it('treats rate-less products as 0% when projecting and averaging', () => {
    const view = buildSuppliedView([
      makeRow({ id: 'a', rate: { value: 0.1, formatted: '10%' }, position: amount(100) }),
      makeRow({ id: 'b', rate: { formatted: '—' }, position: amount(100) })
    ]);
    expect(view.projected1Y).toBeCloseTo(10);
    expect(view.avgRate).toBeCloseTo(0.05);
  });

  it('dedupes the supplied-token cluster by symbol', () => {
    const view = buildSuppliedView([
      makeRow({ id: 'v1', tokenSymbol: 'USDS', position: amount(100) }),
      makeRow({ id: 'v2', tokenSymbol: 'USDS', position: amount(50) }),
      makeRow({ id: 'savings', tokenSymbol: 'sUSDS', position: amount(25) })
    ]);
    expect(view.suppliedTokens).toEqual(['USDS', 'sUSDS']);
  });

  it('excludes products with no/zero position (incl. disconnected)', () => {
    const view = buildSuppliedView([
      makeRow({ id: 'connected', position: amount(100) }),
      makeRow({ id: 'zero', position: amount(0) }),
      makeRow({ id: 'disconnected', position: undefined })
    ]);
    expect(view.positions.map(p => p.id)).toEqual(['connected:1']);
    expect(view.totalSupplied).toBe(100);
  });

  it('returns an empty view for no rows', () => {
    const view = buildSuppliedView([]);
    expect(view).toEqual({
      positions: [],
      totalSupplied: 0,
      projected1Y: 0,
      avgRate: 0,
      ratesLoading: false,
      activePositions: 0,
      hasMatured: false,
      suppliedTokens: []
    });
  });

  describe('matured positions', () => {
    const matured = makeRow({
      id: 'fixed-0xmkt',
      kind: 'fixed',
      tokenSymbol: 'sUSDS',
      status: 'matured',
      // Still settling elsewhere: a matured row never holds the rate skeleton.
      isLoading: true,
      rate: { formatted: '—' },
      position: amount(1000)
    });
    const live = makeRow({
      id: 'savings',
      rate: { value: 0.05, formatted: '5.00%' },
      position: amount(1000)
    });

    it('keeps a held matured position the price feed could not value', () => {
      const unpriced = { ...matured, claimable: true, position: amount(0) };
      const view = buildSuppliedView([unpriced]);
      expect(view.hasMatured).toBe(true);
      expect(view.positions).toHaveLength(1);
      expect(view.positions[0]).toMatchObject({ status: 'matured', amountUsd: 0 });
      expect(view.totalSupplied).toBe(0);
    });

    it('counts a matured balance in the supplied total and the position count', () => {
      const view = buildSuppliedView([live, matured]);
      expect(view.totalSupplied).toBe(2000);
      expect(view.activePositions).toBe(2);
      expect(view.hasMatured).toBe(true);
      expect(view.positions.find(p => p.rowId === 'fixed-0xmkt')).toMatchObject({
        status: 'matured',
        share: 0.5,
        rateLoading: false
      });
    });

    it('leaves a matured balance out of the average rate and projected earnings', () => {
      const view = buildSuppliedView([live, matured]);
      // 5% on the live $1,000 only: the matured $1,000 earns nothing more.
      expect(view.projected1Y).toBeCloseTo(50);
      expect(view.avgRate).toBeCloseTo(0.05);
    });

    it('reports a matured-only wallet as supplied, earning nothing', () => {
      const view = buildSuppliedView([matured]);
      expect(view.totalSupplied).toBe(1000);
      expect(view.projected1Y).toBe(0);
      expect(view.avgRate).toBe(0);
      expect(view.ratesLoading).toBe(false);
    });
  });

  it('flags rates as loading while a position row is still fetching its rate', () => {
    const view = buildSuppliedView([
      rows[0],
      makeRow({
        id: 'vault-usds',
        kind: 'vault',
        rate: { formatted: '—' },
        isLoading: true,
        position: amount(80, { 1: 80 })
      })
    ]);

    expect(view.ratesLoading).toBe(true);
    expect(view.positions.find(p => p.rowId === 'vault-usds')?.rateLoading).toBe(true);
    expect(view.positions.find(p => p.rowId === 'savings')?.rateLoading).toBe(false);

    // A rate-less product that has finished loading is absence, not loading.
    const settled = buildSuppliedView([
      makeRow({ id: 'points', rate: { formatted: '—' }, position: amount(10, { 1: 10 }) })
    ]);
    expect(settled.ratesLoading).toBe(false);
  });
});
