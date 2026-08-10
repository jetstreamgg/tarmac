import { describe, expect, it } from 'vitest';
import { Intent } from '@/lib/enums';
import type { EarnProductRow } from '@/hooks';
import { resolveTokenColor } from '@/widgets/shared/constants';
import { buildIdleSupplyInfo, buildIdleView, type StablecoinBalance } from './idleView';

const balances: StablecoinBalance[] = [
  { symbol: 'USDS', chainId: 1, amount: 600, amountUsd: 600 },
  { symbol: 'USDS', chainId: 8453, amount: 300, amountUsd: 300 },
  { symbol: 'USDC', chainId: 1, amount: 80, amountUsd: 80 },
  { symbol: 'DAI', chainId: 1, amount: 20, amountUsd: 20 }
];

describe('buildIdleView', () => {
  it('aggregates each stablecoin across chains and sorts by amount descending for "all"', () => {
    const view = buildIdleView(balances, 'all');
    expect(view.walletBalance).toBe(1000);
    expect(view.idleCount).toBe(3);
    expect(view.tokens.map(t => t.symbol)).toEqual(['USDS', 'USDC', 'DAI']);
    expect(view.tokens.map(t => t.amountUsd)).toEqual([900, 80, 20]);
    expect(view.tokens.map(t => t.amount)).toEqual([900, 80, 20]);
    expect(view.tokens.map(t => t.share)).toEqual([0.9, 0.08, 0.02]);
  });

  it('decorates tokens with the full display name and brand color', () => {
    const view = buildIdleView(balances, 'all');
    expect(view.tokens[0]).toMatchObject({ symbol: 'USDS', name: 'Sky USD' });
    expect(view.tokens.find(t => t.symbol === 'USDC')?.name).toBe('USD Coin');
    expect(view.tokens[0].color).toBe(resolveTokenColor('USDS'));
  });

  it('scopes totals to the selected chain', () => {
    const ethereum = buildIdleView(balances, 1);
    expect(ethereum.walletBalance).toBe(700); // 600 + 80 + 20
    expect(ethereum.idleCount).toBe(3);

    const base = buildIdleView(balances, 8453);
    expect(base.walletBalance).toBe(300); // USDS only
    expect(base.idleCount).toBe(1);
    expect(base.tokens[0].symbol).toBe('USDS');
  });

  it('excludes zero/negative balances from tokens and the count', () => {
    const view = buildIdleView(
      [
        { symbol: 'USDS', chainId: 1, amount: 100, amountUsd: 100 },
        { symbol: 'USDC', chainId: 1, amount: 0, amountUsd: 0 },
        { symbol: 'USDT', chainId: 1, amount: 0, amountUsd: 0 }
      ],
      'all'
    );
    expect(view.tokens.map(t => t.symbol)).toEqual(['USDS']);
    expect(view.idleCount).toBe(1);
    expect(view.walletBalance).toBe(100);
  });

  it('returns an empty view for no balances', () => {
    expect(buildIdleView([], 'all')).toEqual({ tokens: [], walletBalance: 0, idleCount: 0 });
  });
});

const makeRow = (overrides: Partial<EarnProductRow> & Pick<EarnProductRow, 'id'>): EarnProductRow => ({
  kind: 'savings',
  intent: Intent.SAVINGS_INTENT,
  name: overrides.id,
  tokenSymbol: 'sUSDS',
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

describe('buildIdleSupplyInfo', () => {
  const rows: EarnProductRow[] = [
    makeRow({ id: 'savings', supplyTokens: ['USDS', 'DAI'], rate: { value: 0.04, formatted: '4%' } }),
    makeRow({ id: 'stusds', supplyTokens: ['USDS'], rate: { value: 0.2, formatted: '20%' } }),
    makeRow({ id: 'spark-usdt', supplyTokens: ['USDT'], rate: { value: 0.0425, formatted: '4.25%' } }),
    makeRow({ id: 'fixed', supplyTokens: ['USDS', 'USDC'], rate: { value: 0.05, formatted: '5%' } })
  ];

  it('counts venues per supply token and tracks the best rate', () => {
    const info = buildIdleSupplyInfo(rows);
    expect(info.get('USDS')).toEqual({ venueCount: 3, bestRate: 0.2 });
    expect(info.get('USDT')).toEqual({ venueCount: 1, bestRate: 0.0425 });
    expect(info.get('DAI')).toEqual({ venueCount: 1, bestRate: 0.04 });
    expect(info.get('USDC')).toEqual({ venueCount: 1, bestRate: 0.05 });
  });

  it('keeps bestRate undefined when no venue reports a rate', () => {
    const info = buildIdleSupplyInfo([makeRow({ id: 'loading', supplyTokens: ['USDS'] })]);
    expect(info.get('USDS')).toEqual({ venueCount: 1 });
  });
});
