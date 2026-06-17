import { describe, expect, it } from 'vitest';
import { resolveTokenColor } from '@/widgets/shared/constants';
import { buildIdleView, type StablecoinBalance } from './idleView';

const balances: StablecoinBalance[] = [
  { symbol: 'USDS', chainId: 1, amountUsd: 600 },
  { symbol: 'USDS', chainId: 8453, amountUsd: 300 },
  { symbol: 'USDC', chainId: 1, amountUsd: 80 },
  { symbol: 'DAI', chainId: 1, amountUsd: 20 }
];

describe('buildIdleView', () => {
  it('aggregates each stablecoin across chains and sorts by amount descending for "all"', () => {
    const view = buildIdleView(balances, 'all');
    expect(view.walletBalance).toBe(1000);
    expect(view.idleCount).toBe(3);
    expect(view.tokens.map(t => t.symbol)).toEqual(['USDS', 'USDC', 'DAI']);
    expect(view.tokens.map(t => t.amountUsd)).toEqual([900, 80, 20]);
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
        { symbol: 'USDS', chainId: 1, amountUsd: 100 },
        { symbol: 'USDC', chainId: 1, amountUsd: 0 },
        { symbol: 'USDT', chainId: 1, amountUsd: 0 }
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
