/// <reference types="vite/client" />

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';

// Keep everything in @/hooks real (notably computeVaultLimits, getTokenDecimals,
// usdtAddress, useDebounce) and only stub the two data hooks the widget reads, so
// we can drive the on-chain `maxDeposit` to zero and assert the cap-reached UI.
vi.mock('@/hooks', async importActual => {
  const actual = await importActual<typeof import('@/hooks')>();
  return {
    ...actual,
    useMorphoVaultOnChainData: () => ({
      data: {
        totalAssets: 500_000_000_000_000n,
        totalSupply: 500_000_000_000_000n,
        assetPerShare: 1_000_000n,
        userShares: 0n,
        userAssets: 0n,
        maxDeposit: 0n, // vault is full → cap reached
        maxWithdraw: 0n,
        maxRedeem: 0n,
        asset: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: 6
      },
      isLoading: false,
      mutate: () => {}
    }),
    useVaultMarketData: () => ({ data: undefined, isLoading: false }),
    useTokenBalance: () => ({ data: { value: 1_000_000_000n }, refetch: () => {} }),
    useTokenAllowance: () => ({ data: 0n, mutate: () => {} }),
    useIsBatchSupported: () => ({ data: false })
  };
});

// Analytics is a no-op in tests (mirrors the widget-name-parity test).
vi.mock('@/modules/analytics/hooks/useWidgetAnalytics', () => ({
  useWidgetAnalytics: () => () => {}
}));

import { VaultWidget } from '..';
import { TOKENS } from '@/hooks';

describe('VaultWidget deposit cap', () => {
  it('shows the deposit-cap-reached state when the vault has no remaining room', async () => {
    render(
      <VaultWidget
        vaultAddress="0x74cb54e082411cfCAEADb00a0765625B10410DAa"
        assetAddress="0xdAC17F958D2ee523a2206206994597C13D831ec7"
        assetToken={TOKENS.usdt}
        vaultName="Tether Savings"
        provider="sky"
      />,
      { wrapper: WagmiWrapper }
    );

    // getByTestId throws if absent, so reaching the assertion means it rendered.
    const capNotice = await screen.findByTestId('deposit-cap-reached-sky', undefined, {
      timeout: 10000
    });
    expect(capNotice).toBeTruthy();
  }, 30000);

  // Regression: Morpho V2 vaults return maxDeposit(user) === 0n on-chain even when
  // deposits are open, so the cap-reached gate must NOT fire for the morpho provider
  // (only Spark exposes a real on-chain cap). Same 0n data as above, different provider.
  it('does not show the deposit-cap-reached state for Morpho vaults reading maxDeposit === 0n', async () => {
    render(
      <VaultWidget
        vaultAddress="0x23f5E9c35820f4baB695Ac1F19c203cC3f8e1e11"
        assetAddress="0xdAC17F958D2ee523a2206206994597C13D831ec7"
        assetToken={TOKENS.usdt}
        vaultName="USDT Savings"
        provider="morpho"
      />,
      { wrapper: WagmiWrapper }
    );

    // The supply input must render (proves the widget mounted past loading)...
    await screen.findByTestId('supply-input-morpho', undefined, { timeout: 10000 });
    // ...without the false cap-reached notice that Morpho's 0n maxDeposit would trigger.
    expect(screen.queryByTestId('deposit-cap-reached-morpho')).toBeNull();
  }, 30000);
});
