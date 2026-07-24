import { describe, expect, it } from 'vitest';
import { buildVaultStrategy, IDLE_COLOR, STRATEGY_COLORS } from './vaultStrategy';
import type { MorphoMarketAllocation } from '@/hooks';

// Minimal allocation factory — only the fields buildVaultStrategy reads matter.
const market = (over: Partial<MorphoMarketAllocation>): MorphoMarketAllocation =>
  ({
    marketId: '0x1',
    marketUniqueKey: '0x1',
    loanAsset: 'USDC',
    collateralAsset: 'stUSDS',
    formattedAssets: '',
    formattedAssetsUsd: '',
    assetsUsd: 0,
    formattedNetApy: '',
    totalSupplyAssets: 0n,
    totalBorrowAssets: 0n,
    liquidity: 0n,
    utilization: 0,
    lltv: 0n,
    formattedLltv: '',
    formattedAbsoluteCap: '',
    absoluteCapUtilization: 0,
    formattedRelativeCap: '',
    relativeCapUtilization: 0,
    ...over
  }) as MorphoMarketAllocation;

describe('buildVaultStrategy', () => {
  it('sums allocations and derives proportional shares + labels', () => {
    const view = buildVaultStrategy([
      market({ marketId: '0xa', assetsUsd: 19_920_000, collateralAsset: 'stUSDS', loanAsset: 'USDC' }),
      market({ marketId: '0xb', assetsUsd: 20_000_000, collateralAsset: 'stUSDS', loanAsset: 'USDC' })
    ]);

    expect(view.totalUsd).toBe(39_920_000);
    expect(view.formattedTotal).toBe('$39.92M');
    expect(view.segments).toHaveLength(2);
    expect(view.segments[0].label).toBe('stUSDS/USDC');
    expect(view.segments[0].formattedShare).toBe('50%');
    expect(view.segments[1].formattedShare).toBe('50%');
    expect(view.segments[0].color).toBe(STRATEGY_COLORS[0]);
    expect(view.segments[1].color).toBe(STRATEGY_COLORS[1]);
  });

  it('drops zero/negative allocations and shares sum to 1 over survivors', () => {
    const view = buildVaultStrategy([
      market({ marketId: '0xa', assetsUsd: 30_000_000 }),
      market({ marketId: '0xb', assetsUsd: 0 }),
      market({ marketId: '0xc', assetsUsd: 10_000_000 })
    ]);

    expect(view.segments).toHaveLength(2);
    expect(view.totalUsd).toBe(40_000_000);
    expect(view.segments.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);
    expect(view.segments[0].formattedShare).toBe('75%');
    expect(view.segments[1].formattedShare).toBe('25%');
  });

  it('renders idle capital as a muted segment and shares against total vault capital', () => {
    const view = buildVaultStrategy(
      [market({ marketId: '0xa', assetsUsd: 60_000_000 })],
      [{ assetSymbol: 'USDC', formattedAssets: '', formattedAssetsUsd: '', idleAssetsUsd: 20_000_000 }],
      100_000_000
    );

    expect(view.totalUsd).toBe(100_000_000);
    expect(view.formattedTotal).toBe('$100M');
    expect(view.segments).toHaveLength(2);
    expect(view.segments[0].formattedShare).toBe('60%');
    expect(view.segments[1]).toMatchObject({
      id: 'idle-USDC',
      label: 'Idle',
      formattedShare: '20%',
      color: IDLE_COLOR
    });
  });

  it('drops zero idle rows and falls back to the segment sum when the API total is smaller', () => {
    const view = buildVaultStrategy(
      [
        market({ marketId: '0xa', assetsUsd: 30_000_000 }),
        market({ marketId: '0xb', assetsUsd: 10_000_000 })
      ],
      [{ assetSymbol: 'USDC', formattedAssets: '', formattedAssetsUsd: '', idleAssetsUsd: 0 }],
      25_000_000
    );

    expect(view.segments).toHaveLength(2);
    expect(view.totalUsd).toBe(40_000_000);
    expect(view.segments[0].formattedShare).toBe('75%');
  });

  it('returns an empty view when there are no positive allocations', () => {
    const view = buildVaultStrategy([market({ assetsUsd: 0 })]);
    expect(view.segments).toHaveLength(0);
    expect(view.totalUsd).toBe(0);
    expect(view.formattedTotal).toBe('$0');
  });
});
