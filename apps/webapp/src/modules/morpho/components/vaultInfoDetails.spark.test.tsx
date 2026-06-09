/// <reference types="vite/client" />

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';

const VAULT = '0x74cb54e082411cfCAEADb00a0765625B10410DAa';

// The detail "Vault info" panel is provider-aware AND now API-first for Spark:
// TVL + Available liquidity come from the live Spark Savings API (via the
// `useVaultMarketData` dispatcher) when present, falling back to on-chain reads.
// Drive the seam from the test so we assert the *observable* values rendered.
//
// Available liquidity is the VAULT-LEVEL figure (API summed `liquidity[]`, or the
// on-chain vault buffer as fallback) — deliberately NOT the per-user `maxWithdraw`
// that bounds an individual withdraw input. The on-chain `balanceOf` fallback
// matches the in-widget card, so the two surfaces agree on what the stat means.
let mockMarketData: { data: unknown; isLoading: boolean; error: Error | null } = {
  data: undefined,
  isLoading: false,
  error: null
};
let mockOnChainData: { data: unknown; isLoading: boolean; error: Error | null } = {
  data: undefined,
  isLoading: false,
  error: null
};
let mockOnChainLiquidity: { data: bigint | undefined; isLoading: boolean } = {
  data: undefined,
  isLoading: false
};

vi.mock('@/hooks', async importActual => {
  const actual = await importActual<typeof import('@/hooks')>();
  return {
    ...actual,
    useVaultMarketData: () => mockMarketData,
    useErc4626VaultData: () => mockOnChainData
  };
});

vi.mock('wagmi', async importActual => {
  const actual = await importActual<typeof import('wagmi')>();
  return {
    ...actual,
    // The vault-level liquidity fallback is the vault's ERC-20 `balanceOf`.
    useReadContract: () => mockOnChainLiquidity
  };
});

import { VaultInfoDetails } from './VaultInfoDetails';
import { TOKENS } from '@/hooks';

describe('VaultInfoDetails (Spark API-first, on-chain fallback)', () => {
  it('uses the API tvl + summed liquidity for a Spark vault when present', async () => {
    // API present: its tvl and summed liquidity win over BOTH on-chain figures —
    // and over the per-user maxWithdraw, which is never the "Available liquidity" stat.
    mockMarketData = {
      data: {
        totalAssets: 250_000_000_000_000n, // 250M USDT (6 decimals)
        liquidity: 60_000_000_000_000n // 60M summed API liquidity[]
      },
      isLoading: false,
      error: null
    };
    mockOnChainData = {
      data: {
        totalAssets: 999_000_000_000_000n, // 999M on-chain (must be ignored)
        maxWithdraw: 40_000_000_000_000n // 40M per-user limit (must NOT show as liquidity)
      },
      isLoading: false,
      error: null
    };
    mockOnChainLiquidity = { data: 101_000_000_000_000n, isLoading: false }; // 101M buffer (must be ignored)

    render(<VaultInfoDetails vaultAddress={VAULT} assetToken={TOKENS.usdt} provider="sky" />, {
      wrapper: WagmiWrapper
    });

    expect((await screen.findByTestId('vault-info-tvl')).textContent).toContain('250,000,000');
    const liquidity = screen.getByTestId('vault-info-liquidity').textContent;
    expect(liquidity).toContain('60,000,000');
    expect(liquidity).not.toContain('40,000,000'); // not the per-user maxWithdraw
    expect(liquidity).not.toContain('101,000,000'); // not the on-chain buffer (API wins)
    // Fees are a Morpho-only concept; the Spark panel omits the fee cards entirely.
    expect(screen.queryByText('Management Fee')).toBeNull();
    expect(screen.queryByText('Performance Fee')).toBeNull();
    expect(screen.queryByText(/Unable to fetch data/i)).toBeNull();
  });

  it('falls back to on-chain TVL + vault buffer (not maxWithdraw) when the API is empty', async () => {
    // API absent (empty/down): TVL falls back to on-chain totalAssets and Available
    // liquidity falls back to the vault buffer (balanceOf) — NOT the per-user maxWithdraw.
    mockMarketData = { data: undefined, isLoading: false, error: null };
    mockOnChainData = {
      data: {
        totalAssets: 250_000_000_000_000n, // 250M on-chain
        maxWithdraw: 40_000_000_000_000n // 40M per-user limit (must NOT show as liquidity)
      },
      isLoading: false,
      error: null
    };
    mockOnChainLiquidity = { data: 80_000_000_000_000n, isLoading: false }; // 80M vault buffer

    render(<VaultInfoDetails vaultAddress={VAULT} assetToken={TOKENS.usdt} provider="sky" />, {
      wrapper: WagmiWrapper
    });

    expect((await screen.findByTestId('vault-info-tvl')).textContent).toContain('250,000,000');
    const liquidity = screen.getByTestId('vault-info-liquidity').textContent;
    expect(liquidity).toContain('80,000,000'); // vault buffer fallback
    expect(liquidity).not.toContain('40,000,000'); // never the per-user maxWithdraw
    expect(screen.queryByText(/Unable to fetch data/i)).toBeNull();
  });

  it('renders API-sourced TVL, liquidity, and fees for a Morpho vault (unchanged)', async () => {
    // Morpho: the dispatcher returns its market API; on-chain hooks are never consulted.
    mockOnChainData = { data: undefined, isLoading: false, error: null };
    mockOnChainLiquidity = { data: undefined, isLoading: false };
    mockMarketData = {
      data: {
        totalAssets: 500_000_000_000_000n, // 500M (6 decimals)
        liquidity: 90_000_000_000_000n, // 90M available
        rate: { formattedManagementFee: '5%', formattedPerformanceFee: '10%' }
      },
      isLoading: false,
      error: null
    };

    render(<VaultInfoDetails vaultAddress={VAULT} assetToken={TOKENS.usdt} provider="morpho" />, {
      wrapper: WagmiWrapper
    });

    expect((await screen.findByTestId('vault-info-tvl')).textContent).toContain('500,000,000');
    expect(screen.getByTestId('vault-info-liquidity').textContent).toContain('90,000,000');
    expect(screen.getByText('5%')).toBeTruthy();
    expect(screen.getByText('10%')).toBeTruthy();
  });
});
