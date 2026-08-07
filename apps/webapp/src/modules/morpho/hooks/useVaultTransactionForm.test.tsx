import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { parseUnits } from 'viem';
import type { Token } from '@/hooks';

i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0x1234567890123456789012345678901234567890' as const;
const VAULT = '0xvault' as `0x${string}`;
const POSITION = parseUnits('1000', 18);
const SHARES = parseUnits('950', 18);

const h = vi.hoisted(() => ({
  vaultData: undefined as Record<string, unknown> | undefined,
  marketData: undefined as Record<string, unknown> | undefined,
  marketLoading: false
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({ address: TEST_ADDRESS, isConnected: true, isConnecting: false })
  };
});

// The limits mapping (computeVaultLimits) stays real — Max routing across the
// liquidity states is exactly the seam under test. Only the data reads are stubbed.
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    getTokenDecimals: () => 18,
    useTokenBalance: () => ({ data: { value: 0n } }),
    useErc4626VaultData: () => ({ data: h.vaultData }),
    useVaultMarketData: () => ({ data: h.marketData, isLoading: h.marketLoading })
  };
});

import { useVaultTransactionForm } from './useVaultTransactionForm';

const ASSET = { symbol: 'USDS', address: { 1: '0xusds' } } as unknown as Token;

// Morpho vault data: the on-chain max* reads are stubs that read 0 for everyone
// (APP-456 #7) — liquidity comes from the market API instead.
const morphoVaultData = {
  totalAssets: parseUnits('5000000', 18),
  totalSupply: parseUnits('4750000', 18),
  assetPerShare: parseUnits('1.0526', 18),
  userShares: SHARES,
  userAssets: POSITION,
  maxDeposit: 0n,
  maxWithdraw: 0n,
  maxRedeem: 0n,
  asset: '0xusds',
  decimals: 18
};

const setVaultState = ({
  liquidity,
  marketLoading = false
}: {
  liquidity?: bigint;
  marketLoading?: boolean;
}) => {
  h.vaultData = morphoVaultData;
  h.marketData = liquidity === undefined ? {} : { liquidity };
  h.marketLoading = marketLoading;
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider i18n={i18n}>{children}</I18nProvider>
);

const renderForm = (flow: 'supply' | 'withdraw' = 'withdraw') =>
  renderHook(
    () => useVaultTransactionForm({ flow, vaultAddress: VAULT, assetToken: ASSET, provider: 'morpho' }),
    { wrapper }
  );

describe('useVaultTransactionForm Max routing (APP-488)', () => {
  afterEach(() => cleanup());

  it('liquidity-constrained Max fills the cap and routes to a plain withdraw (max=false)', () => {
    setVaultState({ liquidity: parseUnits('500', 18) });
    const { result } = renderForm();

    expect(result.current.isLiquidityConstrained).toBe(true);
    act(() => result.current.setMaxAmount());

    expect(result.current.value).toBe('500');
    expect(result.current.engineParams.amount).toBe(parseUnits('500', 18));
    // Redeem-all against 500 of liquidity would revert in simulation and
    // dead-end the confirm button — the engine must withdraw(cap) instead.
    expect(result.current.engineParams.max).toBe(false);
  });

  it('unconstrained Max still routes through redeem-all (max=true, no dust)', () => {
    setVaultState({ liquidity: parseUnits('5000', 18) });
    const { result } = renderForm();

    expect(result.current.isLiquidityConstrained).toBe(false);
    act(() => result.current.setMaxAmount());

    expect(result.current.value).toBe('1000');
    expect(result.current.engineParams.max).toBe(true);
    expect(result.current.engineParams.shares).toBe(SHARES);
  });

  it('liquidity exactly covering the position counts as unconstrained (redeem-all)', () => {
    setVaultState({ liquidity: POSITION });
    const { result } = renderForm();

    act(() => result.current.setMaxAmount());
    expect(result.current.engineParams.max).toBe(true);
  });

  it('the 100% chip routes exactly like Max in the constrained case', () => {
    setVaultState({ liquidity: parseUnits('500', 18) });
    const { result } = renderForm();

    act(() => result.current.setPercentAmount(100));

    expect(result.current.value).toBe('500');
    expect(result.current.engineParams.max).toBe(false);
  });

  it('zero liquidity: Max fills 0 and never flags redeem-all', () => {
    setVaultState({ liquidity: 0n });
    const { result } = renderForm();

    expect(result.current.isLiquidityConstrained).toBe(true);
    expect(result.current.available).toBe(0n);
    act(() => result.current.setMaxAmount());

    expect(result.current.engineParams.max).toBe(false);
    expect(result.current.amountReady).toBe(false);
  });

  it('liquidity figure unknown after settling: flags data-unavailable, Max stays a plain withdraw', () => {
    setVaultState({ liquidity: undefined });
    const { result } = renderForm();

    expect(result.current.isLiquidityDataUnavailable).toBe(true);
    // Settled-but-empty liquidity falls back to the full position for the cap…
    act(() => result.current.setMaxAmount());
    expect(result.current.value).toBe('1000');
    // …and the full position is withdrawable as far as we know, so no-dust applies.
    expect(result.current.engineParams.max).toBe(true);
  });

  it('while the liquidity read is in flight the cap is held back and Max is not redeem-all', () => {
    setVaultState({ liquidity: undefined, marketLoading: true });
    const { result } = renderForm();

    expect(result.current.available).toBe(0n);
    act(() => result.current.setMaxAmount());
    expect(result.current.engineParams.max).toBe(false);
  });

  it('typing after Max clears the redeem-all flag', () => {
    setVaultState({ liquidity: parseUnits('5000', 18) });
    const { result } = renderForm();

    act(() => result.current.setMaxAmount());
    expect(result.current.engineParams.max).toBe(true);

    act(() => result.current.onInput('250'));
    expect(result.current.engineParams.max).toBe(false);
    expect(result.current.engineParams.amount).toBe(parseUnits('250', 18));
  });

  it('supply Max never sets the redeem-all flag', () => {
    setVaultState({ liquidity: parseUnits('500', 18) });
    const { result } = renderForm('supply');

    act(() => result.current.setMaxAmount());
    expect(result.current.engineParams.max).toBe(false);
  });
});
