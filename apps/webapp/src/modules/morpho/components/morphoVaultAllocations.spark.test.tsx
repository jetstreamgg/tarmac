/// <reference types="vite/client" />

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';

const VAULT = '0x74cb54e082411cfCAEADb00a0765625B10410DAa';

// Drive the normalized market-data hook the Spark allocations branch reads; keep
// the rest of @/hooks real (notably TOKENS, getTokenDecimals).
let mockMarketData: { data: unknown; isLoading: boolean } = { data: undefined, isLoading: false };

vi.mock('@/hooks', async importActual => {
  const actual = await importActual<typeof import('@/hooks')>();
  return {
    ...actual,
    useVaultMarketData: () => mockMarketData,
    // Morpho fetch is disabled for non-Morpho vaults; stub so it never runs.
    useMorphoVaultMarketApiData: () => ({ data: undefined, isLoading: false }),
    useOverallSkyData: () => ({ data: undefined })
  };
});

import { MorphoVaultAllocationsDetails } from './MorphoVaultAllocationsDetails';
import { TOKENS } from '@/hooks';

describe('MorphoVaultAllocationsDetails (spark)', () => {
  it('renders the normalized Spark allocations breakdown', async () => {
    mockMarketData = {
      data: {
        allocations: [
          { name: 'Spark Liquidity Layer', assets: 200_000_000_000_000n, allocationPercent: 0.8 },
          { name: 'Idle', assets: 50_000_000_000_000n, allocationPercent: 0.2 }
        ]
      },
      isLoading: false
    };

    render(<MorphoVaultAllocationsDetails vaultAddress={VAULT} provider="sky" assetToken={TOKENS.usdt} />, {
      wrapper: WagmiWrapper
    });

    expect(await screen.findByText('Spark Liquidity Layer')).toBeTruthy();
    expect(screen.getByText('Idle')).toBeTruthy();
    // allocationPercent 0.8 → "80.00%" via formatDecimalPercentage.
    expect(screen.getByText('80.00%')).toBeTruthy();
  });

  it('hides the breakdown (renders nothing) when there are no Spark allocations', () => {
    mockMarketData = { data: { allocations: [] }, isLoading: false };

    render(<MorphoVaultAllocationsDetails vaultAddress={VAULT} provider="sky" assetToken={TOKENS.usdt} />, {
      wrapper: WagmiWrapper
    });

    // No allocation data → component returns null, so no table renders.
    expect(screen.queryByRole('table')).toBeNull();
  });
});
