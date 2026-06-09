/// <reference types="vite/client" />

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';

const VAULT = '0x74cb54e082411cfCAEADb00a0765625B10410DAa';

// Feed the chart a normalized Spark payload (history series + live TVL/rate) and
// keep the Morpho chart endpoint stubbed empty — the Spark vault must not hit it.
let mockMarketData: { data: unknown; isLoading: boolean; error: Error | null } = {
  data: undefined,
  isLoading: false,
  error: null
};

vi.mock('@/hooks', async importActual => {
  const actual = await importActual<typeof import('@/hooks')>();
  return {
    ...actual,
    useVaultMarketData: () => mockMarketData,
    useMorphoVaultChartInfo: () => ({ data: [], isLoading: false, error: null })
  };
});

import { MorphoVaultChart } from './MorphoVaultChart';
import { TOKENS } from '@/hooks';

describe('MorphoVaultChart (spark)', () => {
  it('renders the chart from Spark history/market data under a provider-specific test id', async () => {
    mockMarketData = {
      data: {
        totalAssets: 250_000_000_000_000n, // 250M USDT (6 decimals)
        rate: { netRate: 0.0531 },
        history: [
          { blockTimestamp: 1_700_000_000, amount: 100_000_000_000_000n, amountUsd: 100_000_000, apy: 0.04 },
          { blockTimestamp: 1_700_086_400, amount: 200_000_000_000_000n, amountUsd: 200_000_000, apy: 0.05 }
        ]
      },
      isLoading: false,
      error: null
    };

    render(<MorphoVaultChart vaultAddress={VAULT} assetToken={TOKENS.usdt} provider="sky" />, {
      wrapper: WagmiWrapper
    });

    // Provider-specific test id (mirrors the slice-02 `${provider}-...` convention).
    expect(await screen.findByTestId('sky-vault-chart')).toBeTruthy();
    // Not in the error state — data came through cleanly.
    expect(screen.queryByText(/Unable to load chart data/i)).toBeNull();
  });
});
